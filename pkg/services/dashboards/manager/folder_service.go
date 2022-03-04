package service

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
)

type FolderServiceImpl struct {
	dashboardService dashboards.DashboardService
	dashboardStore   dashboards.Store
	searchService    *search.SearchService
	log              log.Logger
}

func ProvideFolderService(dashboardService dashboards.DashboardService, dashboardStore dashboards.Store, searchService *search.SearchService) *FolderServiceImpl {
	return &FolderServiceImpl{
		dashboardService: dashboardService,
		dashboardStore:   dashboardStore,
		searchService:    searchService,
		log:              log.New("folder-service"),
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
	query := models.GetDashboardQuery{OrgId: orgID, Id: id}
	dashFolder, err := getFolder(ctx, query)
	if err != nil {
		return nil, toFolderError(err)
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashToFolder(dashFolder), nil
}

func (f *FolderServiceImpl) GetFolderByUID(ctx context.Context, user *models.SignedInUser, orgID int64, uid string) (*models.Folder, error) {
	query := models.GetDashboardQuery{OrgId: orgID, Uid: uid}
	dashFolder, err := getFolder(ctx, query)

	if err != nil {
		return nil, toFolderError(err)
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashToFolder(dashFolder), nil
}

func (f *FolderServiceImpl) GetFolderByTitle(ctx context.Context, user *models.SignedInUser, orgID int64, title string) (*models.Folder, error) {
	dashFolder, err := f.dashboardStore.GetFolderByTitle(orgID, title)
	if err != nil {
		return nil, toFolderError(err)
	}

	g := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashToFolder(dashFolder), nil
}

func (f *FolderServiceImpl) CreateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, title, uid string) (*models.Folder, error) {
	dashFolder := models.NewDashboardFolder(title)
	dashFolder.OrgId = orgID
	dashFolder.SetUid(strings.TrimSpace(uid))
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

	query := models.GetDashboardQuery{OrgId: orgID, Id: dash.Id}
	dashFolder, err = getFolder(ctx, query)
	if err != nil {
		return nil, toFolderError(err)
	}

	return dashToFolder(dashFolder), nil
}

func (f *FolderServiceImpl) UpdateFolder(ctx context.Context, user *models.SignedInUser, orgID int64, existingUid string, cmd *models.UpdateFolderCommand) error {
	query := models.GetDashboardQuery{OrgId: orgID, Uid: existingUid}
	dashFolder, err := getFolder(ctx, query)
	if err != nil {
		return toFolderError(err)
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

	query = models.GetDashboardQuery{OrgId: orgID, Id: dash.Id}
	dashFolder, err = getFolder(ctx, query)
	if err != nil {
		return toFolderError(err)
	}

	cmd.Result = dashToFolder(dashFolder)

	return nil
}

func (f *FolderServiceImpl) DeleteFolder(ctx context.Context, user *models.SignedInUser, orgID int64, uid string, forceDeleteRules bool) (*models.Folder, error) {
	query := models.GetDashboardQuery{OrgId: orgID, Uid: uid}
	dashFolder, err := getFolder(ctx, query)
	if err != nil {
		return nil, toFolderError(err)
	}

	guard := guardian.New(ctx, dashFolder.Id, orgID, user)
	if canSave, err := guard.CanDelete(); err != nil || !canSave {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	deleteCmd := models.DeleteDashboardCommand{OrgId: orgID, Id: dashFolder.Id, ForceDeleteFolderRules: forceDeleteRules}
	if err := bus.Dispatch(ctx, &deleteCmd); err != nil {
		return nil, toFolderError(err)
	}

	return dashToFolder(dashFolder), nil
}

func (f *FolderServiceImpl) MakeUserAdmin(ctx context.Context, orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error {
	return f.dashboardService.MakeUserAdmin(ctx, orgID, userID, folderID, setViewAndEditPermissions)
}

func getFolder(ctx context.Context, query models.GetDashboardQuery) (*models.Dashboard, error) {
	if err := bus.Dispatch(ctx, &query); err != nil {
		return nil, toFolderError(err)
	}

	if !query.Result.IsFolder {
		return nil, models.ErrFolderNotFound
	}

	return query.Result, nil
}

func dashToFolder(dash *models.Dashboard) *models.Folder {
	return &models.Folder{
		Id:        dash.Id,
		Uid:       dash.Uid,
		Title:     dash.Title,
		HasAcl:    dash.HasAcl,
		Url:       dash.GetUrl(),
		Version:   dash.Version,
		Created:   dash.Created,
		CreatedBy: dash.CreatedBy,
		Updated:   dash.Updated,
		UpdatedBy: dash.UpdatedBy,
	}
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
