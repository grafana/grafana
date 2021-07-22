package dashboards

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/dashboards"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/search"
)

// FolderService is a service for operating on folders.
type FolderService interface {
	GetFolders(limit int64, page int64) ([]*models.Folder, error)
	GetFolderByID(id int64) (*models.Folder, error)
	GetFolderByUID(uid string) (*models.Folder, error)
	GetFolderByTitle(title string) (*models.Folder, error)
	CreateFolder(title, uid string) (*models.Folder, error)
	UpdateFolder(uid string, cmd *models.UpdateFolderCommand) error
	DeleteFolder(uid string) (*models.Folder, error)
	MakeUserAdmin(orgID int64, userID, folderID int64, setViewAndEditPermissions bool) error
}

// NewFolderService is a factory for creating a new folder service.
var NewFolderService = func(orgID int64, user *models.SignedInUser, store dashboards.Store) FolderService {
	return &dashboardServiceImpl{
		orgId:          orgID,
		user:           user,
		dashboardStore: store,
	}
}

func (dr *dashboardServiceImpl) GetFolders(limit int64, page int64) ([]*models.Folder, error) {
	searchQuery := search.Query{
		SignedInUser: dr.user,
		DashboardIds: make([]int64, 0),
		FolderIds:    make([]int64, 0),
		Limit:        limit,
		OrgId:        dr.orgId,
		Type:         "dash-folder",
		Permission:   models.PERMISSION_VIEW,
		Page:         page,
	}

	if err := bus.Dispatch(&searchQuery); err != nil {
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

func (dr *dashboardServiceImpl) GetFolderByID(id int64) (*models.Folder, error) {
	if id == 0 {
		return &models.Folder{Id: id, Title: "General"}, nil
	}
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

func (dr *dashboardServiceImpl) GetFolderByTitle(title string) (*models.Folder, error) {
	dashFolder, err := dr.dashboardStore.GetFolderByTitle(dr.orgId, title)
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

func (dr *dashboardServiceImpl) CreateFolder(title, uid string) (*models.Folder, error) {
	dashFolder := models.NewDashboardFolder(title)
	dashFolder.OrgId = dr.orgId
	dashFolder.SetUid(strings.TrimSpace(uid))
	userID := dr.user.UserId
	if userID == 0 {
		userID = -1
	}
	dashFolder.CreatedBy = userID
	dashFolder.UpdatedBy = userID
	dashFolder.UpdateSlug()

	dto := &SaveDashboardDTO{
		Dashboard: dashFolder,
		OrgId:     dr.orgId,
		User:      dr.user,
	}

	saveDashboardCmd, err := dr.buildSaveDashboardCommand(dto, false, false)
	if err != nil {
		return nil, toFolderError(err)
	}

	dash, err := dr.dashboardStore.SaveDashboard(*saveDashboardCmd)
	if err != nil {
		return nil, toFolderError(err)
	}

	query := models.GetDashboardQuery{OrgId: dr.orgId, Id: dash.Id}
	dashFolder, err = getFolder(query)
	if err != nil {
		return nil, toFolderError(err)
	}

	return dashToFolder(dashFolder), nil
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

	dash, err := dr.dashboardStore.SaveDashboard(*saveDashboardCmd)
	if err != nil {
		return toFolderError(err)
	}

	query = models.GetDashboardQuery{OrgId: dr.orgId, Id: dash.Id}
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
