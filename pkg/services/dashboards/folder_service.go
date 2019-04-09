package dashboards

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
)

// FolderService service for operating on folders
type FolderService interface {
	GetFolders(limit int64) ([]*models.Folder, error)
	GetFolderByID(id int64) (*models.Folder, error)
	GetFolderByUID(uid string) (*models.Folder, error)
	CreateFolder(cmd *models.CreateFolderCommand) error
	UpdateFolder(uid string, cmd *models.UpdateFolderCommand) error
	DeleteFolder(uid string) (*models.Folder, error)
}

// NewFolderService factory for creating a new folder service
var NewFolderService = func(orgId int64, user *models.SignedInUser) FolderService {
	return &dashboardServiceImpl{
		orgId: orgId,
		user:  user,
	}
}

func (dr *dashboardServiceImpl) GetFolders(limit int64) ([]*models.Folder, error) {
	if limit == 0 {
		limit = 1000
	}

	searchQuery := search.Query{
		SignedInUser: dr.user,
		DashboardIds: make([]int64, 0),
		FolderIds:    make([]int64, 0),
		Limit:        limit,
		OrgId:        dr.orgId,
		Type:         "dash-folder",
		Permission:   models.PERMISSION_VIEW,
	}

	if err := bus.Dispatch(&searchQuery); err != nil {
		return nil, err
	}

	folders := make([]*models.Folder, 0)

	for _, hit := range searchQuery.Result {
		folders = append(folders, &models.Folder{
			Id:    hit.Id,
			Uid:   hit.Uid,
			Title: hit.Title,
		})
	}

	return folders, nil
}

func (dr *dashboardServiceImpl) GetFolderByID(id int64) (*models.Folder, error) {
	query := models.GetDashboardQuery{OrgId: dr.orgId, Id: id}
	dashFolder, err := getFolder(query)

	if err != nil {
		return nil, toFolderError(err)
	}

	g := guardian.New(dashFolder.Id, dr.orgId, dr.user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashToFolder(dashFolder), nil
}

func (dr *dashboardServiceImpl) GetFolderByUID(uid string) (*models.Folder, error) {
	query := models.GetDashboardQuery{OrgId: dr.orgId, Uid: uid}
	dashFolder, err := getFolder(query)

	if err != nil {
		return nil, toFolderError(err)
	}

	g := guardian.New(dashFolder.Id, dr.orgId, dr.user)
	if canView, err := g.CanView(); err != nil || !canView {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	return dashToFolder(dashFolder), nil
}

func (dr *dashboardServiceImpl) CreateFolder(cmd *models.CreateFolderCommand) error {
	dashFolder := cmd.GetDashboardModel(dr.orgId, dr.user.UserId)

	dto := &SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     dr.orgId,
		User:      dr.user,
	}

	saveDashboardCmd, err := dr.buildSaveDashboardCommand(dto, false, false)
	if err != nil {
		return toFolderError(err)
	}

	err = bus.Dispatch(saveDashboardCmd)
	if err != nil {
		return toFolderError(err)
	}

	query := models.GetDashboardQuery{OrgId: dr.orgId, Id: saveDashboardCmd.Result.Id}
	dashFolder, err = getFolder(query)
	if err != nil {
		return toFolderError(err)
	}

	cmd.Result = dashToFolder(dashFolder)

	return nil
}

func (dr *dashboardServiceImpl) UpdateFolder(existingUid string, cmd *models.UpdateFolderCommand) error {
	query := models.GetDashboardQuery{OrgId: dr.orgId, Uid: existingUid}
	dashFolder, err := getFolder(query)
	if err != nil {
		return toFolderError(err)
	}

	cmd.UpdateDashboardModel(dashFolder, dr.orgId, dr.user.UserId)

	dto := &SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     dr.orgId,
		User:      dr.user,
		Overwrite: cmd.Overwrite,
	}

	saveDashboardCmd, err := dr.buildSaveDashboardCommand(dto, false, false)
	if err != nil {
		return toFolderError(err)
	}

	err = bus.Dispatch(saveDashboardCmd)
	if err != nil {
		return toFolderError(err)
	}

	query = models.GetDashboardQuery{OrgId: dr.orgId, Id: saveDashboardCmd.Result.Id}
	dashFolder, err = getFolder(query)
	if err != nil {
		return toFolderError(err)
	}

	cmd.Result = dashToFolder(dashFolder)

	return nil
}

func (dr *dashboardServiceImpl) DeleteFolder(uid string) (*models.Folder, error) {
	query := models.GetDashboardQuery{OrgId: dr.orgId, Uid: uid}
	dashFolder, err := getFolder(query)
	if err != nil {
		return nil, toFolderError(err)
	}

	guardian := guardian.New(dashFolder.Id, dr.orgId, dr.user)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		if err != nil {
			return nil, toFolderError(err)
		}
		return nil, models.ErrFolderAccessDenied
	}

	deleteCmd := models.DeleteDashboardCommand{OrgId: dr.orgId, Id: dashFolder.Id}
	if err := bus.Dispatch(&deleteCmd); err != nil {
		return nil, toFolderError(err)
	}

	return dashToFolder(dashFolder), nil
}

func getFolder(query models.GetDashboardQuery) (*models.Dashboard, error) {
	if err := bus.Dispatch(&query); err != nil {
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
	if err == models.ErrDashboardTitleEmpty {
		return models.ErrFolderTitleEmpty
	}

	if err == models.ErrDashboardUpdateAccessDenied {
		return models.ErrFolderAccessDenied
	}

	if err == models.ErrDashboardWithSameNameInFolderExists {
		return models.ErrFolderSameNameExists
	}

	if err == models.ErrDashboardWithSameUIDExists {
		return models.ErrFolderWithSameUIDExists
	}

	if err == models.ErrDashboardVersionMismatch {
		return models.ErrFolderVersionMismatch
	}

	if err == models.ErrDashboardNotFound {
		return models.ErrFolderNotFound
	}

	if err == models.ErrDashboardFailedGenerateUniqueUid {
		err = models.ErrFolderFailedGenerateUniqueUid
	}

	return err
}
