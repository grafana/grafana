package folderimpl

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	store store

	log              log.Logger
	cfg              *setting.Cfg
	dashboardService dashboards.DashboardService
	dashboardStore   dashboards.Store
	searchService    *search.SearchService
	features         featuremgmt.FeatureToggles
	permissions      accesscontrol.FolderPermissionsService
	accessControl    accesscontrol.AccessControl

	// bus is currently used to publish events that cause scheduler to update rules.
	bus bus.Bus
}

func ProvideService(
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	cfg *setting.Cfg,
	dashboardService dashboards.DashboardService,
	dashboardStore dashboards.Store,
	db db.DB, // DB for the (new) nested folder store
	features featuremgmt.FeatureToggles,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	searchService *search.SearchService,
) folder.Service {
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(dashboardStore))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(dashboardStore))
	store := ProvideStore(db, cfg, features)
	svr := &Service{
		cfg:              cfg,
		log:              log.New("folder-service"),
		dashboardService: dashboardService,
		dashboardStore:   dashboardStore,
		store:            store,
		searchService:    searchService,
		features:         features,
		permissions:      folderPermissionsService,
		accessControl:    ac,
		bus:              bus,
	}
	if features.IsEnabled(featuremgmt.FlagNestedFolders) {
		svr.DBMigration(db)
	}
	return svr
}

func (s *Service) DBMigration(db db.DB) {
	ctx := context.Background()
	err := db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		if db.GetDialect().DriverName() == migrator.SQLite {
			_, err = sess.Exec("INSERT OR REPLACE INTO folder (id, uid, org_id, title, created, updated) SELECT id, uid, org_id, title, created, updated FROM dashboard WHERE is_folder = 1")
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

	if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		if ok, err := s.accessControl.Evaluate(ctx, cmd.SignedInUser, accesscontrol.EvalPermission(
			dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(*cmd.UID),
		)); !ok {
			if err != nil {
				return nil, toFolderError(err)
			}
			return nil, dashboards.ErrFolderAccessDenied
		}
		return s.store.Get(ctx, *cmd)
	}

	switch {
	case cmd.UID != nil:
		return s.getFolderByUID(ctx, cmd.SignedInUser, cmd.OrgID, *cmd.UID)
	case cmd.ID != nil:
		return s.getFolderByID(ctx, cmd.SignedInUser, *cmd.ID, cmd.OrgID)
	case cmd.Title != nil:
		return s.getFolderByTitle(ctx, cmd.SignedInUser, cmd.OrgID, *cmd.Title)
	default:
		return nil, folder.ErrBadRequest.Errorf("either on of UID, ID, Title fields must be present")
	}
}

func (s *Service) GetFolders(ctx context.Context, user *user.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
	searchQuery := search.Query{
		SignedInUser: user,
		DashboardIds: make([]int64, 0),
		FolderIds:    make([]int64, 0),
		Limit:        limit,
		OrgId:        orgID,
		Type:         "dash-folder",
		Permission:   models.PERMISSION_VIEW,
		Page:         page,
	}

	if err := s.searchService.SearchHandler(ctx, &searchQuery); err != nil {
		return nil, err
	}

	folders := make([]*models.Folder, 0)

	for _, hit := range searchQuery.Result {
		folders = append(folders, &models.Folder{
			Id:    hit.ID,
			Uid:   hit.UID,
			Title: hit.Title,
		})
	}

	return folders, nil
}

func (s *Service) getFolderByID(ctx context.Context, user *user.SignedInUser, id int64, orgID int64) (*folder.Folder, error) {
	if id == 0 {
		return &folder.Folder{ID: id, Title: "General"}, nil
	}

	dashFolder, err := s.dashboardStore.GetFolderByID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.ID, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) getFolderByUID(ctx context.Context, user *user.SignedInUser, orgID int64, uid string) (*folder.Folder, error) {
	dashFolder, err := s.dashboardStore.GetFolderByUID(ctx, orgID, uid)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.ID, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) getFolderByTitle(ctx context.Context, user *user.SignedInUser, orgID int64, title string) (*folder.Folder, error) {
	dashFolder, err := s.dashboardStore.GetFolderByTitle(ctx, orgID, title)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.ID, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	logger := s.log.FromContext(ctx)

	dashFolder := models.NewDashboardFolder(cmd.Title)
	dashFolder.OrgId = cmd.OrgID

	trimmedUID := strings.TrimSpace(cmd.UID)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, dashboards.ErrFolderInvalidUID
	}

	dashFolder.SetUid(trimmedUID)

	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}
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
		OrgId:     cmd.OrgID,
		User:      user,
	}

	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var createdFolder *folder.Folder
	createdFolder, err = s.dashboardStore.GetFolderByID(ctx, cmd.OrgID, dash.Id)
	if err != nil {
		return nil, err
	}

	var permissionErr error
	if !accesscontrol.IsDisabled(s.cfg) {
		var permissions []accesscontrol.SetResourcePermissionCommand
		if user.IsRealUser() && !user.IsAnonymous {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: userID, Permission: models.PERMISSION_ADMIN.String(),
			})
		}

		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: models.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: models.PERMISSION_VIEW.String()},
		}...)

		_, permissionErr = s.permissions.SetPermissions(ctx, cmd.OrgID, createdFolder.UID, permissions...)
	} else if s.cfg.EditorsCanAdmin && user.IsRealUser() && !user.IsAnonymous {
		permissionErr = s.MakeUserAdmin(ctx, cmd.OrgID, userID, createdFolder.ID, true)
	}

	if permissionErr != nil {
		logger.Error("Could not make user admin", "folder", createdFolder.Title, "user", userID, "error", permissionErr)
	}

	if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		cmd := &folder.CreateFolderCommand{
			// TODO: Today, if a UID isn't specified, the dashboard store
			// generates a new UID. The new folder store will need to do this as
			// well, but for now we take the UID from the newly created folder.
			UID:         dash.Uid,
			OrgID:       cmd.OrgID,
			Title:       cmd.Title,
			Description: cmd.Description,
			ParentUID:   cmd.ParentUID,
		}
		if err := s.nestedFolderCreate(ctx, cmd); err != nil {
			// We'll log the error and also roll back the previously-created
			// (legacy) folder.
			logger.Error("error saving folder to nested folder store", "error", err)
			// do not shallow create error if the legacy folder delete fails
			deleteErr := s.DeleteFolder(ctx, &folder.DeleteFolderCommand{UID: createdFolder.UID, OrgID: cmd.OrgID, ForceDeleteRules: true, SignedInUser: user})
			if deleteErr != nil {
				logger.Error("error deleting folder after failed save to nested folder store", "error", err)
			}
			return folder.FromDashboard(dash), err
		}
		// The folder UID is specified (or generated) during creation, so we'll
		// stop here and return the created model.Folder.
	}
	return folder.FromDashboard(dash), nil
}

func (s *Service) Update(ctx context.Context, user *user.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) (*folder.Folder, error) {
	foldr, err := s.legacyUpdate(ctx, user, orgID, existingUid, cmd)
	if err != nil {
		return nil, err
	}

	if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		if cmd.Uid != "" {
			if !util.IsValidShortUID(cmd.Uid) {
				return nil, dashboards.ErrDashboardInvalidUid
			} else if util.IsShortUIDTooLong(cmd.Uid) {
				return nil, dashboards.ErrDashboardUidTooLong
			}
		}

		getFolder, err := s.store.Get(ctx, folder.GetFolderQuery{
			UID:   &existingUid,
			OrgID: orgID,
		})
		if err != nil {
			return nil, err
		}
		foldr, err := s.store.Update(ctx, folder.UpdateFolderCommand{
			Folder:         getFolder,
			NewUID:         &cmd.Uid,
			NewTitle:       &cmd.Title,
			NewDescription: &cmd.Description,
		})
		if err != nil {
			return nil, err
		}
		return foldr, nil
	}
	return foldr, nil
}

func (s *Service) legacyUpdate(ctx context.Context, user *user.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) (*folder.Folder, error) {
	logger := s.log.FromContext(ctx)

	query := models.GetDashboardQuery{OrgId: orgID, Uid: existingUid}
	_, err := s.dashboardStore.GetDashboard(ctx, &query)
	if err != nil {
		return nil, toFolderError(err)
	}

	dashFolder := query.Result
	currentTitle := dashFolder.Title

	if !dashFolder.IsFolder {
		return nil, dashboards.ErrFolderNotFound
	}

	cmd.UpdateDashboardModel(dashFolder, orgID, user.UserID)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     orgID,
		User:      user,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := s.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := s.dashboardStore.SaveDashboard(ctx, *saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var foldr *folder.Folder
	foldr, err = s.dashboardStore.GetFolderByID(ctx, orgID, dash.Id)
	if err != nil {
		return nil, err
	}

	if currentTitle != foldr.Title {
		if err := s.bus.Publish(ctx, &events.FolderTitleUpdated{
			Timestamp: foldr.Updated,
			Title:     foldr.Title,
			ID:        dash.Id,
			UID:       dash.Uid,
			OrgID:     orgID,
		}); err != nil {
			logger.Error("failed to publish FolderTitleUpdated event", "folder", foldr.Title, "user", user.UserID, "error", err)
		}
	}
	return foldr, nil
}

func (s *Service) DeleteFolder(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	logger := s.log.FromContext(ctx)
	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}

	if s.features.IsEnabled(featuremgmt.FlagNestedFolders) {
		err := s.Delete(ctx, cmd)
		if err != nil {
			logger.Error("the delete folder on folder table failed with err: ", "error", err)
		}
	}

	dashFolder, err := s.dashboardStore.GetFolderByUID(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return err
	}

	guard := guardian.New(ctx, dashFolder.ID, cmd.OrgID, cmd.SignedInUser)
	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return toFolderError(err)
		}
		return dashboards.ErrFolderAccessDenied
	}

	deleteCmd := models.DeleteDashboardCommand{OrgId: cmd.OrgID, Id: dashFolder.ID, ForceDeleteFolderRules: cmd.ForceDeleteRules}

	if err := s.dashboardStore.DeleteDashboard(ctx, &deleteCmd); err != nil {
		return toFolderError(err)
	}
	return nil
}

func (s *Service) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	if cmd.SignedInUser == nil {
		return nil, folder.ErrBadRequest.Errorf("missing signed in user")
	}

	foldr, err := s.Get(ctx, &folder.GetFolderQuery{
		UID:          &cmd.UID,
		OrgID:        cmd.OrgID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return nil, err
	}

	return s.store.Update(ctx, folder.UpdateFolderCommand{
		Folder: foldr,
		// NewParentUID: &cmd.NewParentUID,
	})
}

func (s *Service) Delete(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	if cmd.SignedInUser == nil {
		return folder.ErrBadRequest.Errorf("missing signed in user")
	}

	_, err := s.Get(ctx, &folder.GetFolderQuery{
		UID:          &cmd.UID,
		OrgID:        cmd.OrgID,
		SignedInUser: cmd.SignedInUser,
	})
	if err != nil {
		return err
	}

	folders, err := s.store.GetChildren(ctx, folder.GetTreeQuery{UID: cmd.UID, OrgID: cmd.OrgID})
	if err != nil {
		return err
	}
	for _, f := range folders {
		err := s.Delete(ctx, &folder.DeleteFolderCommand{UID: f.UID, OrgID: f.OrgID, ForceDeleteRules: cmd.ForceDeleteRules})
		if err != nil {
			return err
		}
	}
	err = s.store.Delete(ctx, cmd.UID, cmd.OrgID)
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) GetParents(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	// check the flag, if old - do whatever did before
	//  for new only the store
	return s.store.GetParents(ctx, *cmd)
}

func (s *Service) GetTree(ctx context.Context, cmd *folder.GetTreeQuery) ([]*folder.Folder, error) {
	// check the flag, if old - do whatever did before
	//  for new only the store
	return s.store.GetChildren(ctx, *cmd)
}

func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.dashboardService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
}

func (s *Service) nestedFolderCreate(ctx context.Context, cmd *folder.CreateFolderCommand) error {
	if cmd.ParentUID != "" {
		if err := s.validateParent(ctx, cmd.OrgID, cmd.ParentUID); err != nil {
			return err
		}
	}
	_, err := s.store.Create(ctx, *cmd)
	return err
}

func (s *Service) validateParent(ctx context.Context, orgID int64, parentUID string) error {
	ancestors, err := s.store.GetParents(ctx, folder.GetParentsQuery{UID: parentUID, OrgID: orgID})
	if err != nil {
		return err
	}

	if len(ancestors) == folder.MaxNestedFolderDepth {
		return folder.ErrMaximumDepthReached
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

	if errors.Is(err, dashboards.ErrDashboardFailedGenerateUniqueUid) {
		err = dashboards.ErrFolderFailedGenerateUniqueUid
	}

	return err
}
