package guardian

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
)

var _ DashboardGuardian = new(accessControlDashboardGuardian)

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboardId.
func NewAccessControlDashboardGuardian(
	ctx context.Context, cfg *setting.Cfg, dashboardId int64, user identity.Requester,
	ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService,
	foldersService folder.Service, logger log.Logger,
) (DashboardGuardian, error) {
	var dashboard *dashboards.Dashboard
	if dashboardId != 0 {
		q := &dashboards.GetDashboardQuery{
			ID:    dashboardId,
			OrgID: user.GetOrgID(),
		}

		qResult, err := dashboardService.GetDashboard(ctx, q)
		if err != nil {
			if errors.Is(err, dashboards.ErrDashboardNotFound) {
				return nil, ErrGuardianDashboardNotFound.Errorf("failed to get dashboard by UID: %w", err)
			}
			return nil, ErrGuardianGetDashboardFailure.Errorf("failed to get dashboard by UID: %w", err)
		}
		dashboard = qResult
	}

	if dashboard != nil && dashboard.IsFolder {
		logger.Info("using dashboard guardian for folder", "folder", dashboard.UID)
		return &accessControlFolderGuardian{
			accessControlBaseGuardian: accessControlBaseGuardian{
				ctx:              ctx,
				cfg:              cfg,
				log:              log.New("folder.permissions"),
				user:             user,
				ac:               ac,
				dashboardService: dashboardService,
			},
			folder: dashboards.FromDashboard(dashboard),
		}, nil
	}

	return &accessControlDashboardGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			ctx:              ctx,
			cfg:              cfg,
			log:              log.New("dashboard.permissions"),
			user:             user,
			ac:               ac,
			dashboardService: dashboardService,
			folderService:    foldersService,
		},
		dashboard: dashboard,
	}, nil
}

// NewAccessControlDashboardGuardianByDashboard creates a dashboard guardian by the provided dashboard.
// This constructor should be preferred over the other two if the dashboard is available
// since it avoids querying the database for fetching the dashboard.
func NewAccessControlDashboardGuardianByDashboard(
	ctx context.Context, cfg *setting.Cfg, dashboard *dashboards.Dashboard, user identity.Requester,
	ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService, folderService folder.Service,
	logger log.Logger,
) (DashboardGuardian, error) {
	if dashboard != nil && dashboard.IsFolder {
		logger.Info("using by dashboard guardian for folder", "folder", dashboard.UID)
		return &accessControlFolderGuardian{
			accessControlBaseGuardian: accessControlBaseGuardian{
				ctx:              ctx,
				cfg:              cfg,
				log:              log.New("folder.permissions"),
				user:             user,
				ac:               ac,
				dashboardService: dashboardService,
				folderService:    folderService,
			},
			folder: dashboards.FromDashboard(dashboard),
		}, nil
	}

	return &accessControlDashboardGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			cfg:              cfg,
			ctx:              ctx,
			log:              log.New("dashboard.permissions"),
			user:             user,
			ac:               ac,
			dashboardService: dashboardService,
			folderService:    folderService,
		},
		dashboard: dashboard,
	}, nil
}

// NewAccessControlFolderGuardianByUID creates a folder guardian by the provided folderUID.
func NewAccessControlFolderGuardianByUID(
	ctx context.Context, cfg *setting.Cfg, folderUID string, user identity.Requester,
	ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService, foldersService folder.Service,
) (DashboardGuardian, error) {
	if folderUID == "" {
		return nil, ErrGuardianFolderNotFound.Errorf("failed to get folder by UID: folder UID is empty")
	}

	q := &folder.GetFolderQuery{
		UID:          &folderUID,
		OrgID:        user.GetOrgID(),
		SignedInUser: user,
	}

	f, err := foldersService.Get(ctx, q)
	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return nil, ErrGuardianFolderNotFound.Errorf("failed to get folder by UID: %w", err)
		}
		return nil, ErrGuardianGetFolderFailure.Errorf("failed to get folder by UID: %w", err)
	}

	return &accessControlFolderGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			ctx:              ctx,
			cfg:              cfg,
			log:              log.New("folder.permissions"),
			user:             user,
			ac:               ac,
			dashboardService: dashboardService,
			folderService:    foldersService,
		},
		folder: f,
	}, nil
}

// NewAccessControlFolderGuardian creates a folder guardian by the provided folder.
func NewAccessControlFolderGuardian(
	ctx context.Context, cfg *setting.Cfg, f *folder.Folder, user identity.Requester,
	ac accesscontrol.AccessControl, orgID int64, dashboardService dashboards.DashboardService,
	folderService folder.Service,
) (DashboardGuardian, error) {
	if f.UID == "" { // nolint:staticcheck
		query := &folder.GetFolderQuery{
			ID:           &f.ID, // nolint:staticcheck
			OrgID:        orgID,
			SignedInUser: user,
		}

		folder, err := folderService.Get(ctx, query)
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return nil, ErrGuardianFolderNotFound.Errorf("failed to get folder: %w", err)
			}
			return nil, ErrGuardianGetFolderFailure.Errorf("failed to get folder: %w", err)
		}
		f = folder
	}

	return &accessControlFolderGuardian{
		accessControlBaseGuardian: accessControlBaseGuardian{
			ctx:              ctx,
			cfg:              cfg,
			log:              log.New("folder.permissions"),
			user:             user,
			ac:               ac,
			dashboardService: dashboardService,
			folderService:    folderService,
		},
		folder: f,
	}, nil
}

type accessControlBaseGuardian struct {
	cfg              *setting.Cfg
	ctx              context.Context
	log              log.Logger
	user             identity.Requester
	ac               accesscontrol.AccessControl
	dashboardService dashboards.DashboardService
	folderService    folder.Service
}

type accessControlDashboardGuardian struct {
	accessControlBaseGuardian
	dashboard *dashboards.Dashboard
}

type accessControlFolderGuardian struct {
	accessControlBaseGuardian
	folder *folder.Folder
}

func (a *accessControlDashboardGuardian) CanSave() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check save permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanSave() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check save permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanEdit() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check edit permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanEdit() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check edit permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanView() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check view permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanView() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check view permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanAdmin() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check admin permissions for dashboard")
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsRead, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
		accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	))
}

func (a *accessControlFolderGuardian) CanAdmin() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check admin permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalAll(
		accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsRead, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)),
		accesscontrol.EvalPermission(dashboards.ActionFoldersPermissionsWrite, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)),
	))
}

func (a *accessControlDashboardGuardian) CanDelete() (bool, error) {
	if a.dashboard == nil {
		return false, ErrGuardianDashboardNotFound.Errorf("failed to check delete permissions for dashboard")
	}

	return a.evaluate(
		accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(a.dashboard.UID)),
	)
}

func (a *accessControlFolderGuardian) CanDelete() (bool, error) {
	if a.folder == nil {
		return false, ErrGuardianFolderNotFound.Errorf("failed to check delete permissions for folder")
	}

	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersDelete, dashboards.ScopeFoldersProvider.GetResourceScopeUID(a.folder.UID)))
}

func (a *accessControlDashboardGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}
	folder, err := a.loadParentFolder(folderID)
	if err != nil {
		return false, err
	}
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID)))
}

func (a *accessControlFolderGuardian) CanCreate(folderID int64, isFolder bool) (bool, error) {
	if isFolder {
		return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionFoldersCreate))
	}
	folder, err := a.loadParentFolder(folderID)
	if err != nil {
		return false, err
	}
	return a.evaluate(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.UID)))
}

func (a *accessControlDashboardGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	if err != nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Failed to evaluate access control to dashboard", "error", err, "identity", a.user.GetID(), "id", id)
	}

	if !ok && err == nil {
		id := 0
		if a.dashboard != nil {
			id = int(a.dashboard.ID)
		}
		a.log.Debug("Access denied to dashboard", "identity", a.user.GetID(), "id", id, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *accessControlFolderGuardian) evaluate(evaluator accesscontrol.Evaluator) (bool, error) {
	ok, err := a.ac.Evaluate(a.ctx, a.user, evaluator)
	if err != nil {
		uid := ""
		orgID := 0
		if a.folder != nil {
			uid = a.folder.UID
			orgID = int(a.folder.OrgID)
		}
		a.log.Debug("Failed to evaluate access control to folder", "error", err, "identity", a.user.GetID(), "orgID", orgID, "uid", uid)
	}

	if !ok && err == nil {
		uid := ""
		orgID := 0
		if a.folder != nil {
			uid = a.folder.UID
			orgID = int(a.folder.OrgID)
		}
		a.log.Debug("Access denied to folder", "identity", a.user.GetID(), "identity", a.user.GetID(), "orgID", orgID, "uid", uid, "permissions", evaluator.GoString())
	}

	return ok, err
}

func (a *accessControlDashboardGuardian) loadParentFolder(folderID int64) (*folder.Folder, error) {
	if folderID == 0 {
		return &folder.Folder{UID: accesscontrol.GeneralFolderUID, OrgID: a.user.GetOrgID()}, nil
	}
	folderQuery := &folder.GetFolderQuery{ID: &folderID, OrgID: a.user.GetOrgID(), SignedInUser: a.user}
	folderQueryResult, err := a.folderService.Get(a.ctx, folderQuery)
	if err != nil {
		return nil, err
	}
	return folderQueryResult, nil
}

func (a *accessControlFolderGuardian) loadParentFolder(folderID int64) (*folder.Folder, error) {
	if folderID == 0 {
		return &folder.Folder{UID: accesscontrol.GeneralFolderUID, OrgID: a.user.GetOrgID()}, nil
	}
	folderQuery := &folder.GetFolderQuery{ID: &folderID, OrgID: a.user.GetOrgID(), SignedInUser: a.user}
	folderQueryResult, err := a.folderService.Get(a.ctx, folderQuery)
	if err != nil {
		return nil, err
	}
	return folderQueryResult, nil
}
