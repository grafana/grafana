package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
)

type FolderServiceImpl struct {
	log              log.Logger
	cfg              *setting.Cfg
	dashboardService dashboards.DashboardService
	dashboardStore   dashboards.Store
	searchService    *search.SearchService
	features         featuremgmt.FeatureToggles
	permissions      accesscontrol.FolderPermissionsService

	// bus is currently used to publish events that cause scheduler to update rules.
	bus bus.Bus
}

func ProvideFolderService(
	cfg *setting.Cfg, dashboardService dashboards.DashboardService, dashboardStore dashboards.Store,
	searchService *search.SearchService, features featuremgmt.FeatureToggles, folderPermissionsService accesscontrol.FolderPermissionsService,
	ac accesscontrol.AccessControl, bus bus.Bus,
) *FolderServiceImpl {
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderNameScopeResolver(dashboardStore))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(dashboardStore))

	return &FolderServiceImpl{
		cfg:              cfg,
		log:              log.New("folder-service"),
		dashboardService: dashboardService,
		dashboardStore:   dashboardStore,
		searchService:    searchService,
		features:         features,
		permissions:      folderPermissionsService,
		bus:              bus,
	}
}

func (f *FolderServiceImpl) GetFolders(ctx context.Context, user *models.SignedInUser, orgID int64, limit int64, page int64) ([]*models.Folder, error) {
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

	if err := f.searchService.SearchHandler(ctx, &searchQuery); err != nil {
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

func (f *FolderServiceImpl) GetFolderByID(ctx context.Context, user *models.SignedInUser, id int64, orgID int64) (*models.Folder, error) {
	if id == 0 {
		return &models.Folder{Id: id, Title: "General"}, nil
	}
	dashFolder, err := f.dashboardStore.GetFolderByID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (f *FolderServiceImpl) GetFolderByUID(ctx context.Context, user *models.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	dashFolder, err := f.dashboardStore.GetFolderByUID(ctx, orgID, uid)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (f *FolderServiceImpl) GetFolderByTitle(ctx context.Context, user *models.SignedInUser, orgID int64, title string) (*models.Folder, error) {
	dashFolder, err := f.dashboardStore.GetFolderByTitle(ctx, orgID, title)
	if err != nil {
		return nil, err
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashFolder, nil
}

func (f *FolderServiceImpl) CreateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, title, uid string) (*models.Folder, error) {
	dashFolder := models.NewDashboardFolder(title)
	dashFolder.OrgId = orgID

	trimmedUID := strings.TrimSpace(uid)
	if trimmedUID == accesscontrol.GeneralFolderUID {
		return nil, models.ErrFolderInvalidUID
	}

	dashFolder.SetUid(trimmedUID)
	userID := user.UserId
	if userID == 0 {
		userID = -1
	}
	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     orgID,
		User:      user,
	}

	saveDashboardCmd, err := f.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := f.dashboardStore.SaveDashboard(*saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	var folder *models.Folder
	folder, err = f.dashboardStore.GetFolderByID(ctx, orgID, dash.Id)
	if err != nil {
		return nil, err
	}

	var permissionErr error
	if !accesscontrol.IsDisabled(f.cfg) {
		_, permissionErr = f.permissions.SetPermissions(ctx, orgID, folder.Uid, []accesscontrol.SetResourcePermissionCommand{
			{UserID: userID, Permission: models.PERMISSION_ADMIN.String()},
			{BuiltinRole: string(models.ROLE_EDITOR), Permission: models.PERMISSION_EDIT.String()},
			{BuiltinRole: string(models.ROLE_VIEWER), Permission: models.PERMISSION_VIEW.String()},
		}...)
	} else if f.cfg.EditorsCanAdmin {
		permissionErr = f.MakeUserAdmin(ctx, orgID, userID, folder.Id, true)
	}

	if permissionErr != nil {
		f.log.Error("Could not make user admin", "folder", folder.Title, "user", userID, "error", permissionErr)
	}

	return folder, nil
}

func (f *FolderServiceImpl) UpdateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error {
	query := models.GetDashboardQuery{OrgId: orgID, Uid: existingUid}
	if _, err := f.dashboardStore.GetDashboard(ctx, &query); err != nil {
		return toFolderError(err)
	}

	dashFolder := query.Result

	if !dashFolder.IsFolder {
		return models.ErrFolderNotFound
	}

	cmd.UpdateDashboardModel(dashFolder, orgID, user.UserId)

	dto := &dashboards.SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     orgID,
		User:      user,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := f.dashboardService.BuildSaveDashboardCommand(ctx, dto, false, false)
	if err != nil {
		return toFolderError(err)
	}

	dash, err := f.dashboardStore.SaveDashboard(*saveDashboardCmd)
	if err != nil {
		return toFolderError(err)
	}

	var folder *models.Folder
	folder, err = f.dashboardStore.GetFolderByID(ctx, orgID, dash.Id)
	if err != nil {
		return err
	}
	cmd.Result = folder

	if err := f.bus.Publish(ctx, &events.FolderUpdated{
		Timestamp: time.Now(),
		Title:     folder.Title,
		ID:        dash.Id,
		UID:       dash.Uid,
		OrgID:     orgID,
	}); err != nil {
		f.log.Error("failed to publish FolderUpdated event", "folder", folder.Title, "user", user.UserId, "error", err)
	}

	return nil
}

func (f *FolderServiceImpl) DeleteFolder(ctx context.Context, user *models.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error) {
	dashFolder, err := f.dashboardStore.GetFolderByUID(ctx, orgID, uid)
	if err != nil {
		return nil, err
	}

	guard := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	deleteCmd := models.DeleteDashboardCommand{OrgId: orgID, Id: dashFolder.Id, ForceDeleteFolderRules: forceDeleteRules}

	if err := f.dashboardStore.DeleteDashboard(ctx, &deleteCmd); err != nil {
		return nil, toFolderError(err)
	}

	return dashFolder, nil
}

func (f *FolderServiceImpl) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return f.dashboardService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
}

func toFolderError(err error) error {
	if errors.Is(err, models.ErrDashboardTitleEmpty) {
		return models.ErrFolderTitleEmpty
	}

	if errors.Is(err, models.ErrDashboardUpdateAccessDenied) {
		return models.ErrFolderAccessDenied
	}

	if errors.Is(err, models.ErrDashboardWithSameNameInFolderExists) {
		return models.ErrFolderSameNameExists
	}

	if errors.Is(err, models.ErrDashboardWithSameUIDExists) {
		return models.ErrFolderWithSameUIDExists
	}

	if errors.Is(err, models.ErrDashboardVersionMismatch) {
		return models.ErrFolderVersionMismatch
	}

	if errors.Is(err, models.ErrDashboardNotFound) {
		return models.ErrFolderNotFound
	}

	if errors.Is(err, models.ErrDashboardFailedGenerateUniqueUid) {
		err = models.ErrFolderFailedGenerateUniqueUid
	}

	return err
}
