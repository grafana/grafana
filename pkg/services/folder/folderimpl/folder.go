package folderimpl

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service struct {
	store                store
	db                   db.DB
	log                  log.Logger
	cfg                  *setting.Cfg
	dashboardStore       dashboards.Store
	dashboardFolderStore folder.FolderStore
	features             featuremgmt.FeatureToggles
	accessControl        accesscontrol.AccessControl

	// bus is currently used to publish event in case of title change
	bus bus.Bus

	mutex    sync.RWMutex
	registry map[string]folder.RegistryService
}

func ProvideService(
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	cfg *setting.Cfg,
	dashboardStore dashboards.Store,
	folderStore folder.FolderStore,
	db db.DB, // DB for the (new) nested folder store
	features featuremgmt.FeatureToggles,
) folder.Service {
	store := ProvideStore(db, cfg, features)
	srv := &Service{
		cfg:                  cfg,
		log:                  log.New("folder-service"),
		dashboardStore:       dashboardStore,
		dashboardFolderStore: folderStore,
		store:                store,
		features:             features,
		accessControl:        ac,
		bus:                  bus,
		db:                   db,
		registry:             make(map[string]folder.RegistryService),
	}
	if features.IsEnabled(featuremgmt.FlagNestedFolders) {
		srv.DBMigration(db)
	}

	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(folderStore, srv))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(folderStore, srv))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderUIDScopeResolver(srv))
	return srv
}

func (s *Service) DBMigration(db db.DB) {
	ctx := context.Background()
	err := db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		if db.GetDialect().DriverName() == migrator.SQLite {
			_, err = sess.Exec("INSERT OR IGNORE INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1")
		} else if db.GetDialect().DriverName() == migrator.Postgres {
			_, err = sess.Exec("INSERT INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = true ON CONFLICT DO NOTHING")
		} else {
			_, err = sess.Exec("INSERT IGNORE INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1")
		}
		return err
	})
	if err != nil {
		s.log.Error("DB migration on folder service start failed.")
	}
}

func (s *Service) Get(ctx context.Context, cmd *folder.GetFolderQuery) (*folder.Folder, error) {
	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	var dashFolder *folder.Folder
	var err error
	switch {
	case cmd.UID != nil:
		dashFolder, err = s.getFolderByUID(ctx, cmd.OrgID, *cmd.UID)
		if err != nil {
			return nil, err
		}
	case cmd.ID != nil:
		dashFolder, err = s.getFolderByID(ctx, *cmd.ID, cmd.OrgID)
		if err != nil {
			return nil, err
		}
	case cmd.Title != nil:
		dashFolder, err = s.getFolderByTitle(ctx, cmd.OrgID, *cmd.Title)
		if err != nil {
			return nil, err
		}
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}

	if dashFolder.IsGeneral() {
		return dashFolder, nil
	}

	// do not get guardian by the folder ID because it differs from the nested folder ID
	// and the legacy folder ID has been associated with the permissions:
	// use the folde UID instead that is the same for both
	g, err := guardian.NewByUID(ctx, dashFolder.UID, dashFolder.OrgID, cmd.SignedInUser)
	if err != nil {
		return nil, err
	}

	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	if !s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		return dashFolder, nil
	}

	if cmd.ID != nil {
		cmd.ID = nil
		cmd.UID = &dashFolder.UID
	}

	f, err := s.store.Get(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	// always expose the dashboard store sequential ID
	f.ID = dashFolder.ID

	return f, err
}

func (s *Service) GetChildren(ctx context.Context, cmd *folder.GetChildrenQuery) ([]*folder.Folder, error) {
	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	children, err := s.store.GetChildren(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	filtered := make([]*folder.Folder, 0, len(children))
	for _, f := range children {
		// fetch folder from dashboard store
		dashFolder, err := s.dashboardFolderStore.GetFolderByUID(ctx, f.OrgID, f.UID)
		if err != nil {
			s.log.Error("failed to fetch folder by UID from dashboard store", "uid", f.UID, "error", err)
			continue
		}

		g, err := guardian.NewByUID(ctx, f.UID, f.OrgID, cmd.SignedInUser)
		if err != nil {
			return nil, err
		}
		canView, err := g.CanView()
		if err != nil || canView {
			// always expose the dashboard store sequential ID
			f.ID = dashFolder.ID
			filtered = append(filtered, f)
		}
	}

	return filtered, nil
}

func (s *Service) GetParents(ctx context.Context, q folder.GetParentsQuery) ([]*folder.Folder, error) {
	if !s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		return nil, nil
	}
	return s.store.GetParents(ctx, q)
}

func (s *Service) getFolderByID(ctx context.Context, id int64, orgID int64) (*folder.Folder, error) {
	if id == 0 {
		return &folder.GeneralFolder, nil
	}

	return s.dashboardFolderStore.GetFolderByID(ctx, orgID, id)
}

func (s *Service) getFolderByUID(ctx context.Context, orgID int64, uid string) (*folder.Folder, error) {
	return s.dashboardFolderStore.GetFolderByUID(ctx, orgID, uid)
}

func (s *Service) getFolderByTitle(ctx context.Context, orgID int64, title string) (*folder.Folder, error) {
	return s.dashboardFolderStore.GetFolderByTitle(ctx, orgID, title)
}

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	logger := s.log.FromContext(ctx)

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if !s.accessControl.IsDisabled() && s.features.IsEnabled(featuremgmt.FlagNestedFolders) && cmd.ParentUID != "" {
		// Check that the user is allowed to create a subfolder in this folder
		evaluator := accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.ParentUID))
		hasAccess, evalErr := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator)
		if evalErr != nil {
			return nil, evalErr
		}
		if !hasAccess {
			return nil, dashboards.ErrFolderAccessDenied
		}
	}

	dashFolder := dashboards.NewDashboardFolder(cmd.Title)
	dashFolder.OrgID = cmd.OrgID

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}

	dashFolder.SetUID(trimmedUID)

	user := cmd.SignedInUser
	userID := user.UserID
	if userID == 0 {
		userID = -1
	}
	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgID:     cmd.OrgID,
		User:      user,
	}

	saveDashboardCmd, err := s.BuildSaveDashboardCommand(ctx, dto)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var createdFolder *folder.Folder
	createdFolder, err = s.dashboardFolderStore.GetFolderByID(ctx, cmd.OrgID, dash.ID)
	if err != nil {
		return nil, err
	}

	var nestedFolder *folder.Folder
	if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		cmd := &folder.CreateFolderCommand{
			// TODO: Today, if a UID isn't specified, the dashboard store
			// generates a new UID. The new folder store will need to do this as
			// well, but for now we take the UID from the newly created folder.
			UID:         dash.UID,
			OrgID:       cmd.OrgID,
			Title:       cmd.Title,
			Description: cmd.Description,
			ParentUID:   cmd.ParentUID,
		}
		nestedFolder, err = s.nestedFolderCreate(ctx, cmd)
		if err != nil {
			// We'll log the error and also roll back the previously-created
			// (legacy) folder.
			logger.Error("error saving folder to nested folder store", "error", err)
			// do not shallow create error if the legacy folder delete fails
			if deleteErr := s.dashboardStore.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{
				ID:    createdFolder.ID,
				OrgID: createdFolder.OrgID,
			}); deleteErr != nil {
				logger.Error("error deleting folder after failed save to nested folder store", "error", err)
			}
			return dashboards.FromDashboard(dash), err
		}
	}

	f := dashboards.FromDashboard(dash)
	if nestedFolder != nil && nestedFolder.ParentUID != "" {
		f.ParentUID = nestedFolder.ParentUID
	}
	return f, nil
}

func (s *Service) Update(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}
	user := cmd.SignedInUser

	dashFolder, err := s.legacyUpdate(ctx, cmd)
	if err != nil {
		return nil, err
	}

	if !s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		return dashFolder, nil
	}

	if cmd.NewUID != nil && *cmd.NewUID != "" {
		if !util.IsValidShortUID(*cmd.NewUID) {
			return nil, dashboards.ErrDashboardInvalidUid
		} else if util.IsShortUIDTooLong(*cmd.NewUID) {
			return nil, dashboards.ErrDashboardUidTooLong
		}
	}

	foldr, err := s.store.Update(ctx, folder.UpdateFolderCommand{
		UID:            cmd.UID,
		OrgID:          cmd.OrgID,
		NewUID:         cmd.NewUID,
		NewTitle:       cmd.NewTitle,
		NewDescription: cmd.NewDescription,
		SignedInUser:   user,
	})
	if err != nil {
		return nil, err
	}

	// always expose the dashboard store sequential ID
	foldr.ID = dashFolder.ID

	return foldr, nil
}

func (s *Service) legacyUpdate(ctx context.Context, cmd *folder.UpdateFolderCommand) (*folder.Folder, error) {
	logger := s.log.FromContext(ctx)

	query := dashboards.GetDashboardQuery{OrgID: cmd.OrgID, UID: cmd.UID}
	queryResult, err := s.dashboardStore.GetDashboard(ctx, &query)
	if err != nil {
		return nil, toFolderError(err)
	}

	dashFolder := queryResult
	currentTitle := dashFolder.Title

	if !dashFolder.IsFolder {
		return nil, dashboards.ErrFolderNotFound
	}

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}
	user := cmd.SignedInUser

	prepareForUpdate(dashFolder, cmd.OrgID, cmd.SignedInUser.UserID, cmd)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgID:     cmd.OrgID,
		User:      cmd.SignedInUser,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := s.BuildSaveDashboardCommand(ctx, dto)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var foldr *folder.Folder
	foldr, err = s.dashboardFolderStore.GetFolderByID(ctx, cmd.OrgID, dash.ID)
	if err != nil {
		return nil, err
	}

	if currentTitle != foldr.Title {
		if err := s.bus.Publish(ctx, &events.FolderTitleUpdated{
			Timestamp: foldr.Updated,
			Title:     foldr.Title,
			ID:        dash.ID,
			UID:       dash.UID,
			OrgID:     cmd.OrgID,
		}); err != nil {
			logger.Error("failed to publish FolderTitleUpdated event", "folder", foldr.Title, "user", user.UserID, "error", err)
		}
	}
	return foldr, nil
}

// prepareForUpdate updates an existing dashboard model from command into model for folder update
func prepareForUpdate(dashFolder *dashboards.Dashboard, orgId int64, userId int64, cmd *folder.UpdateFolderCommand) {
	dashFolder.OrgID = orgId

	title := dashFolder.Title
	if cmd.NewTitle != nil && *cmd.NewTitle != "" {
		title = *cmd.NewTitle
	}
	dashFolder.Title = strings.TrimSpace(title)
	dashFolder.Data.Set("title", dashFolder.Title)

	if cmd.NewUID != nil && *cmd.NewUID != "" {
		dashFolder.SetUID(*cmd.NewUID)
	}

	dashFolder.SetVersion(cmd.Version)
	dashFolder.IsFolder = true

	if userId == 0 {
		userId = -1
	}

	dashFolder.UpdatedBy = userId
	dashFolder.UpdateSlug()
}

func (s *Service) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	logger := s.log.FromContext(ctx)
	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}
	if cmd.UID == "" {
		return folder.ErrBadRequest.Errorf("missing UID")
	}
	if cmd.OrgID < 1 {
		return folder.ErrBadRequest.Errorf("invalid orgID")
	}
	result := []string{cmd.UID}
	err := s.db.InTransaction(ctx, func(ctx context.Context) error {
		if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
			subfolders, err := s.nestedFolderDelete(ctx, cmd)

			if err != nil {
				logger.Error("the delete folder on folder table failed with err: ", "error", err)
				return err
			}
			result = append(result, subfolders...)
		}

		for _, folder := range result {
			dashFolder, err := s.dashboardFolderStore.GetFolderByUID(ctx, cmd.OrgID, folder)
			if err != nil {
				return err
			}

			guard, err := guardian.NewByUID(ctx, dashFolder.UID, cmd.OrgID, cmd.SignedInUser)
			if err != nil {
				return err
			}

			if canSave, err := guard.CanDelete(); err != nil || !canSave {
				if err != nil {
					return toFolderError(err)
				}
				return dashboards.ErrFolderAccessDenied
			}

			if err := s.deleteChildrenInFolder(ctx, dashFolder.OrgID, dashFolder.UID); err != nil {
				return err
			}

			err = s.legacyDelete(ctx, cmd, dashFolder)
			if err != nil {
				return err
			}
		}
		return nil
	})

	return err
}

func (s *Service) deleteChildrenInFolder(ctx context.Context, orgID int64, UID string) error {
	for _, v := range s.registry {
		if err := v.DeleteInFolder(ctx, orgID, UID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) legacyDelete(ctx context.Context, cmd *folder.DeleteFolderCommand, dashFolder *folder.Folder) error {
	deleteCmd := dashboards.DeleteDashboardCommand{OrgID: cmd.OrgID, ID: dashFolder.ID, ForceDeleteFolderRules: cmd.ForceDeleteRules}

	if err := s.dashboardStore.DeleteDashboard(ctx, &deleteCmd); err != nil {
		return toFolderError(err)
	}
	return nil
}

func (s *Service) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	// Check that the user is allowed to move the folder to the destination folder
	if !s.accessControl.IsDisabled() {
		var evaluator accesscontrol.Evaluator
		if cmd.NewParentUID != "" {
			evaluator = accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(cmd.NewParentUID))
		} else {
			// Evaluate folder creation permission when moving folder to the root level
			evaluator = accesscontrol.EvalPermission(dashboards.ActionFoldersCreate)
		}
		hasAccess, evalErr := s.accessControl.Evaluate(ctx, cmd.SignedInUser, evaluator)
		if evalErr != nil {
			return nil, evalErr
		}
		if !hasAccess {
			return nil, dashboards.ErrFolderAccessDenied
		}
	} else {
		g, err := guardian.NewByUID(ctx, cmd.UID, cmd.OrgID, cmd.SignedInUser)
		if err != nil {
			return nil, err
		}
		if canSave, err := g.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, toFolderError(err)
			}
			return nil, dashboards.ErrFolderAccessDenied
		}
	}

	// here we get the folder, we need to get the height of current folder
	// and the depth of the new parent folder, the sum can't bypass 8
	folderHeight, err := s.store.GetHeight(ctx, cmd.UID, cmd.OrgID, &cmd.NewParentUID)
	if err != nil {
		return nil, err
	}
	parents, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: cmd.NewParentUID, OrgID: cmd.OrgID})
	if err != nil {
		return nil, err
	}

	// current folder height + current folder + parent folder + parent folder depth should be less than or equal 8
	if folderHeight+len(parents)+2 > folder.MaxNestedFolderDepth {
		return nil, folder.ErrMaximumDepthReached
	}

	// if the current folder is already a parent of newparent, we should return error
	for _, parent := range parents {
		if parent.UID == cmd.UID {
			return nil, folder.ErrCircularReference
		}
	}

	newParentUID := ""
	if cmd.NewParentUID != "" {
		newParentUID = cmd.NewParentUID
	}
	return s.store.Update(ctx, folder.UpdateFolderCommand{
		UID:          cmd.UID,
		OrgID:        cmd.OrgID,
		NewParentUID: &newParentUID,
		SignedInUser: cmd.SignedInUser,
	})
}

// nestedFolderDelete inspects the folder referenced by the cmd argument, deletes all the entries for
// its descendant folders (folders which are nested within it either directly or indirectly) from
// the folder store and returns the UIDs for all its descendants.
func (s *Service) nestedFolderDelete(ctx context.Context, cmd *folder.DeleteFolderCommand) ([]string, error) {
	logger := s.log.FromContext(ctx)
	result := []string{}
	if cmd.SignedInUser == nil {
		return result, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	_, err := s.Get(ctx, &folder.GetFolderQuery{
		UID:          &cmd.UID,
		OrgID:        cmd.OrgID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return result, err
	}

	folders, err := s.store.GetChildren(ctx, folder.GetChildrenQuery{UID: cmd.UID, OrgID: cmd.OrgID})
	if err != nil {
		return result, err
	}
	for _, f := range folders {
		result = append(result, f.UID)
		logger.Info("deleting subfolder", "org_id", f.OrgID, "uid", f.UID)
		subfolders, err := s.nestedFolderDelete(ctx, &folder.DeleteFolderCommand{UID: f.UID, OrgID: f.OrgID, ForceDeleteRules: cmd.ForceDeleteRules, SignedInUser: cmd.SignedInUser})
		if err != nil {
			logger.Error("failed deleting subfolder", "org_id", f.OrgID, "uid", f.UID, "error", err)
			return result, err
		}
		result = append(result, subfolders...)
	}

	logger.Info("deleting folder and its contents", "org_id", cmd.OrgID, "uid", cmd.UID)
	err = s.store.Delete(ctx, cmd.UID, cmd.OrgID)
	if err != nil {
		logger.Info("failed deleting folder", "org_id", cmd.OrgID, "uid", cmd.UID, "err", err)
		return result, err
	}
	return result, nil
}

// MakeUserAdmin is copy of DashboardServiceImpl.MakeUserAdmin
func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	rtEditor := org.RoleEditor
	rtViewer := org.RoleViewer

	items := []*dashboards.DashboardACL{
		{
			OrgID:       orgID,
			DashboardID: folderID,
			UserID:      userID,
			Permission:  dashboards.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}

	if setViewAndEditPermissions {
		items = append(items,
			&dashboards.DashboardACL{
				OrgID:       orgID,
				DashboardID: folderID,
				Role:        &rtEditor,
				Permission:  dashboards.PERMISSION_EDIT,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
			&dashboards.DashboardACL{
				OrgID:       orgID,
				DashboardID: folderID,
				Role:        &rtViewer,
				Permission:  dashboards.PERMISSION_VIEW,
				Created:     time.Now(),
				Updated:     time.Now(),
			},
		)
	}

	if err := s.dashboardStore.UpdateDashboardACL(ctx, folderID, items); err != nil {
		return err
	}

	return nil
}

// BuildSaveDashboardCommand is a simplified version on DashboardServiceImpl.BuildSaveDashboardCommand
// keeping only the meaningful functionality for folders
func (s *Service) BuildSaveDashboardCommand(ctx context.Context, dto *dashboards.SaveDashboardDTO) (*dashboards.SaveDashboardCommand, error) {
	dash := dto.Dashboard

	dash.OrgID = dto.OrgID
	dash.Title = strings.TrimSpace(dash.Title)
	dash.Data.Set("title", dash.Title)
	dash.SetUID(strings.TrimSpace(dash.UID))

	if dash.Title == "" {
		return nil, dashboards.ErrDashboardTitleEmpty
	}

	if dash.IsFolder && dash.FolderID > 0 {
		return nil, dashboards.ErrDashboardFolderCannotHaveParent
	}

	if dash.IsFolder && strings.EqualFold(dash.Title, dashboards.RootFolderName) {
		return nil, dashboards.ErrDashboardFolderNameExists
	}

	if !util.IsValidShortUID(dash.UID) {
		return nil, dashboards.ErrDashboardInvalidUid
	} else if util.IsShortUIDTooLong(dash.UID) {
		return nil, dashboards.ErrDashboardUidTooLong
	}

	_, err := s.dashboardStore.ValidateDashboardBeforeSave(ctx, dash, dto.Overwrite)
	if err != nil {
		return nil, err
	}

	guard, err := getGuardianForSavePermissionCheck(ctx, dash, dto.User)
	if err != nil {
		return nil, err
	}

	if dash.ID == 0 {
		if canCreate, err := guard.CanCreate(dash.FolderID, dash.IsFolder); err != nil || !canCreate {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	} else {
		if canSave, err := guard.CanSave(); err != nil || !canSave {
			if err != nil {
				return nil, err
			}
			return nil, dashboards.ErrDashboardUpdateAccessDenied
		}
	}

	cmd := &dashboards.SaveDashboardCommand{
		Dashboard: dash.Data,
		Message:   dto.Message,
		OrgID:     dto.OrgID,
		Overwrite: dto.Overwrite,
		UserID:    dto.User.UserID,
		FolderID:  dash.FolderID,
		IsFolder:  dash.IsFolder,
		PluginID:  dash.PluginID,
	}

	if !dto.UpdatedAt.IsZero() {
		cmd.UpdatedAt = dto.UpdatedAt
	}

	return cmd, nil
}

// getGuardianForSavePermissionCheck returns the guardian to be used for checking permission of dashboard
// It replaces deleted Dashboard.GetDashboardIdForSavePermissionCheck()
func getGuardianForSavePermissionCheck(ctx context.Context, d *dashboards.Dashboard, user *user.SignedInUser) (guardian.DashboardGuardian, error) {
	newDashboard := d.ID == 0

	if newDashboard {
		// if it's a new dashboard/folder check the parent folder permissions
		guard, err := guardian.New(ctx, d.FolderID, d.OrgID, user)
		if err != nil {
			return nil, err
		}
		return guard, nil
	}
	guard, err := guardian.NewByDashboard(ctx, d, d.OrgID, user)
	if err != nil {
		return nil, err
	}
	return guard, nil
}

func (s *Service) nestedFolderCreate(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	if cmd.ParentUID != "" {
		if err := s.validateParent(ctx, cmd.OrgID, cmd.ParentUID, cmd.UID); err != nil {
			return nil, err
		}
	}
	return s.store.Create(ctx, *cmd)
}

func (s *Service) validateParent(ctx context.Context, orgID int64, parentUID string, UID string) error {
	ancestors, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: parentUID, OrgID: orgID})
	if err != nil {
		return fmt.Errorf("failed to get parents: %w", err)
	}

	if len(ancestors) == folder.MaxNestedFolderDepth {
		return folder.ErrMaximumDepthReached
	}

	// Create folder under itself is not allowed
	if parentUID == UID {
		return folder.ErrCircularReference
	}

	// check there is no circular reference
	for _, ancestor := range ancestors {
		if ancestor.UID == UID {
			return folder.ErrCircularReference
		}
	}

	return nil
}

func toFolderError(err error) error {
	if errors.Is(err, dashboards.ErrDashboardTitleEmpty) {
		return dashboards.ErrFolderTitleEmpty
	}

	if errors.Is(err, dashboards.ErrDashboardUpdateAccessDenied) {
		return dashboards.ErrFolderAccessDenied
	}

	if errors.Is(err, dashboards.ErrDashboardWithSameNameInFolderExists) {
		return dashboards.ErrFolderSameNameExists
	}

	if errors.Is(err, dashboards.ErrDashboardWithSameUIDExists) {
		return dashboards.ErrFolderWithSameUIDExists
	}

	if errors.Is(err, dashboards.ErrDashboardVersionMismatch) {
		return dashboards.ErrFolderVersionMismatch
	}

	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		return dashboards.ErrFolderNotFound
	}

	return err
}

func (s *Service) RegisterService(r folder.RegistryService) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	_, ok := s.registry[r.Kind()]
	if ok {
		return folder.ErrTargetRegistrySrvConflict.Errorf("target registry service: %s already exists", r.Kind())
	}

	s.registry[r.Kind()] = r

	return nil
}
