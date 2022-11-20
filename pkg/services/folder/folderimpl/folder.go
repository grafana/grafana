package folderimpl

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"

	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	storeWrapper storeWrapper

	log              log.Logger
	cfg              *setting.Cfg
	dashboardService dashboards.DashboardService
	searchService    *search.SearchService
	features         *featuremgmt.FeatureManager
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
	features *featuremgmt.FeatureManager,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	searchService *search.SearchService,
) folder.Service {
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(dashboardStore))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(dashboardStore))
	store := ProvideStore(db, cfg)
	storeWrapper := ProvideStoreWrapper(cfg, dashboardService, dashboardStore, store)
	svr := &Service{
		cfg:              cfg,
		log:              log.New("folder-service"),
		storeWrapper:     storeWrapper,
		dashboardService: dashboardService,
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
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	f, err := s.storeWrapper.Get(ctx, *cmd)
	if err != nil {
		return nil, err
	}

	if f.ID == 0 {
		return f, nil
	}

	g := guardian.New(ctx, f.ID, f.OrgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, dashboards.ErrFolderAccessDenied
	}

	return f, nil
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

func (s *Service) Create(ctx context.Context, cmd *folder.CreateFolderCommand) (*folder.Folder, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	createdFolder, err := s.storeWrapper.Create(ctx, cmd)
	if err != nil {
		return nil, err
	}

	var permissionErr error
	if !accesscontrol.IsDisabled(s.cfg) {
		var permissions []accesscontrol.SetResourcePermissionCommand
		if user.IsRealUser() && !user.IsAnonymous {
			permissions = append(permissions, accesscontrol.SetResourcePermissionCommand{
				UserID: user.UserID, Permission: models.PERMISSION_ADMIN.String(),
			})
		}

		permissions = append(permissions, []accesscontrol.SetResourcePermissionCommand{
			{BuiltinRole: string(org.RoleEditor), Permission: models.PERMISSION_EDIT.String()},
			{BuiltinRole: string(org.RoleViewer), Permission: models.PERMISSION_VIEW.String()},
		}...)

		_, permissionErr = s.permissions.SetPermissions(ctx, cmd.OrgID, createdFolder.UID, permissions...)
	} else if s.cfg.EditorsCanAdmin && user.IsRealUser() && !user.IsAnonymous {
		permissionErr = s.MakeUserAdmin(ctx, cmd.OrgID, user.UserID, createdFolder.ID, true)
	}

	if permissionErr != nil {
		s.log.Error("Could not make user admin", "folder", createdFolder.Title, "user", user.UserID, "error", permissionErr)
	}

	return createdFolder, nil
}

func (s *Service) Update(ctx context.Context, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) (*folder.Folder, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	f, err := s.storeWrapper.Get(ctx, folder.GetFolderQuery{OrgID: orgID, UID: &existingUid})
	if err != nil {
		return nil, toFolderError(err)
	}

	currentTitle := f.Title

	f, err = s.storeWrapper.Update(ctx, folder.UpdateFolderCommand{
		Folder:         f,
		NewUID:         &cmd.Uid,
		NewTitle:       &cmd.Title,
		NewDescription: &cmd.Description,
	})
	if err != nil {
		return nil, toFolderError(err)
	}

	if currentTitle != f.Title {
		if err := s.bus.Publish(ctx, &events.FolderTitleUpdated{
			Timestamp: f.Updated,
			Title:     f.Title,
			ID:        f.ID,
			UID:       f.UID,
			OrgID:     orgID,
		}); err != nil {
			s.log.Error("failed to publish FolderTitleUpdated event", "folder", f.Title, "user", user.UserID, "error", err)
		}
	}
	return f, nil
}

func (s *Service) DeleteFolder(ctx context.Context, cmd *folder.DeleteFolderCommand) error {
	user, err := appcontext.User(ctx)
	if err != nil {
		return err
	}

	dashFolder, err := s.storeWrapper.Get(ctx, folder.GetFolderQuery{OrgID: cmd.OrgID, UID: &cmd.UID})
	if err != nil {
		return err
	}

	guard := guardian.New(ctx, dashFolder.ID, cmd.OrgID, user)
	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return toFolderError(err)
		}
		return dashboards.ErrFolderAccessDenied
	}

	if err := s.storeWrapper.Delete(ctx, cmd); err != nil {
		return toFolderError(err)
	}
	return nil
}

func (s *Service) Move(ctx context.Context, cmd *folder.MoveFolderCommand) (*folder.Folder, error) {
	foldr, err := s.Get(ctx, &folder.GetFolderQuery{
		UID:   &cmd.UID,
		OrgID: cmd.OrgID,
	})
	if err != nil {
		return nil, err
	}

	return s.storeWrapper.Update(ctx, folder.UpdateFolderCommand{
		Folder:       foldr,
		NewParentUID: &cmd.NewParentUID,
	})
}

func (s *Service) GetParents(ctx context.Context, cmd *folder.GetParentsQuery) ([]*folder.Folder, error) {
	// check the flag, if old - do whatever did before
	//  for new only the store
	return s.storeWrapper.GetParents(ctx, *cmd)
}

func (s *Service) GetTree(ctx context.Context, cmd *folder.GetTreeQuery) ([]*folder.Folder, error) {
	// check the flag, if old - do whatever did before
	//  for new only the store
	return s.storeWrapper.GetChildren(ctx, *cmd)
}

func (s *Service) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return s.dashboardService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
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
