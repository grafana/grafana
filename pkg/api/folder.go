package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func getFolderHelper(orgId int64, id int64, uid string) (*m.Dashboard, Response) {
	query := m.GetDashboardQuery{OrgId: orgId, Id: id, Uid: uid}
	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrDashboardNotFound {
			err = m.ErrFolderNotFound
		}

		return nil, ApiError(404, "Folder not found", err)
	}

	if !query.Result.IsFolder {
		return nil, ApiError(404, "Folder not found", m.ErrFolderNotFound)
	}

	return query.Result, nil
}

func folderGuardianResponse(err error) Response {
	if err != nil {
		return ApiError(500, "Error while checking folder permissions", err)
	}

	return ApiError(403, "Access denied to this folder", nil)
}

func GetFoldersForSignedInUser(c *middleware.Context) Response {
	title := c.Query("query")
	query := m.GetFoldersForSignedInUserQuery{
		OrgId:        c.OrgId,
		SignedInUser: c.SignedInUser,
		Title:        title,
	}

	err := bus.Dispatch(&query)
	if err != nil {
		return ApiError(500, "Failed to retrieve folders", err)
	}

	return Json(200, query.Result)
}

func GetFolder(c *middleware.Context) Response {
	folder, rsp := getFolderHelper(c.OrgId, c.ParamsInt64(":id"), c.Params(":uid"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(folder.Id, c.OrgId, c.SignedInUser)
	if canView, err := guardian.CanView(); err != nil || !canView {
		fmt.Printf("%v", err)
		return folderGuardianResponse(err)
	}

	return Json(200, toDto(guardian, folder))
}

func CreateFolder(c *middleware.Context, cmd m.CreateFolderCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId

	dashFolder := cmd.GetDashboardModel()

	guardian := guardian.NewDashboardGuardian(0, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return folderGuardianResponse(err)
	}

	if dashFolder.Title == "" {
		return ApiError(400, m.ErrFolderTitleEmpty.Error(), nil)
	}

	limitReached, err := middleware.QuotaReached(c, "folder")
	if err != nil {
		return ApiError(500, "failed to get quota", err)
	}
	if limitReached {
		return ApiError(403, "Quota reached", nil)
	}

	dashItem := &dashboards.SaveDashboardItem{
		Dashboard: dashFolder,
		OrgId:     c.OrgId,
		UserId:    c.UserId,
	}

	folder, err := dashboards.GetRepository().SaveDashboard(dashItem)

	if err != nil {
		return toFolderError(err)
	}

	return Json(200, toDto(guardian, folder))
}

func UpdateFolder(c *middleware.Context, cmd m.UpdateFolderCommand) Response {
	cmd.OrgId = c.OrgId
	cmd.UserId = c.UserId
	uid := c.Params(":uid")

	dashFolder, rsp := getFolderHelper(c.OrgId, 0, uid)
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashFolder.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return folderGuardianResponse(err)
	}

	cmd.UpdateDashboardModel(dashFolder)

	if dashFolder.Title == "" {
		return ApiError(400, m.ErrFolderTitleEmpty.Error(), nil)
	}

	dashItem := &dashboards.SaveDashboardItem{
		Dashboard: dashFolder,
		OrgId:     c.OrgId,
		UserId:    c.UserId,
		Overwrite: cmd.Overwrite,
	}

	folder, err := dashboards.GetRepository().SaveDashboard(dashItem)

	if err != nil {
		return toFolderError(err)
	}

	return Json(200, toDto(guardian, folder))
}

func DeleteFolder(c *middleware.Context) Response {
	dashFolder, rsp := getFolderHelper(c.OrgId, 0, c.Params(":uid"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashFolder.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return folderGuardianResponse(err)
	}

	deleteCmd := m.DeleteDashboardCommand{OrgId: c.OrgId, Id: dashFolder.Id}
	if err := bus.Dispatch(&deleteCmd); err != nil {
		return ApiError(500, "Failed to delete folder", err)
	}

	var resp = map[string]interface{}{"title": dashFolder.Title}
	return Json(200, resp)
}

func toDto(guardian *guardian.DashboardGuardian, folder *m.Dashboard) dtos.Folder {
	canEdit, _ := guardian.CanEdit()
	canSave, _ := guardian.CanSave()
	canAdmin, _ := guardian.CanAdmin()

	// Finding creator and last updater of the folder
	updater, creator := "Anonymous", "Anonymous"
	if folder.CreatedBy > 0 {
		creator = getUserLogin(folder.CreatedBy)
	}
	if folder.UpdatedBy > 0 {
		updater = getUserLogin(folder.UpdatedBy)
	}

	return dtos.Folder{
		Id:        folder.Id,
		Uid:       folder.Uid,
		Title:     folder.Title,
		Url:       folder.GetUrl(),
		HasAcl:    folder.HasAcl,
		CanSave:   canSave,
		CanEdit:   canEdit,
		CanAdmin:  canAdmin,
		CreatedBy: creator,
		Created:   folder.Created,
		UpdatedBy: updater,
		Updated:   folder.Updated,
		Version:   folder.Version,
	}
}

func toFolderError(err error) Response {
	if err == m.ErrDashboardTitleEmpty {
		return ApiError(400, m.ErrFolderTitleEmpty.Error(), nil)
	}

	if err == m.ErrDashboardWithSameNameInFolderExists {
		return Json(412, util.DynMap{"status": "name-exists", "message": m.ErrFolderSameNameExists.Error()})
	}

	if err == m.ErrDashboardWithSameUIDExists {
		return Json(412, util.DynMap{"status": "uid-exists", "message": m.ErrFolderWithSameUIDExists.Error()})
	}

	if err == m.ErrDashboardVersionMismatch {
		return Json(412, util.DynMap{"status": "version-mismatch", "message": m.ErrFolderVersionMismatch.Error()})
	}

	if err == m.ErrDashboardNotFound {
		return Json(404, util.DynMap{"status": "not-found", "message": m.ErrFolderNotFound.Error()})
	}

	if err == m.ErrDashboardFailedGenerateUniqueUid {
		err = m.ErrFolderFailedGenerateUniqueUid
	}

	return ApiError(500, "Failed to create folder", err)
}
