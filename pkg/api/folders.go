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

func getFolderHelper(orgId int64, slug string, id int64) (*m.Dashboard, Response) {
	query := m.GetDashboardQuery{Slug: slug, Id: id, OrgId: orgId}
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

func GetFolders(c *middleware.Context) Response {
	title := c.Query("query")
	query := m.GetFoldersQuery{
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

func GetFolderById(c *middleware.Context) Response {
	folder, rsp := getFolderHelper(c.OrgId, "", c.ParamsInt64(":id"))
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

	dashFolder := m.NewDashboardFolder(cmd.Title)

	guardian := guardian.NewDashboardGuardian(0, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return folderGuardianResponse(err)
	}

	// Check if Title is empty
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

	dashFolder.CreatedBy = c.UserId
	dashFolder.UpdatedBy = c.UserId

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

	dashFolder, rsp := getFolderHelper(c.OrgId, "", c.ParamsInt64(":id"))
	if rsp != nil {
		return rsp
	}

	guardian := guardian.NewDashboardGuardian(dashFolder.Id, c.OrgId, c.SignedInUser)
	if canSave, err := guardian.CanSave(); err != nil || !canSave {
		return folderGuardianResponse(err)
	}

	dashFolder.Data.Set("title", cmd.Title)
	dashFolder.Title = cmd.Title
	dashFolder.Data.Set("version", cmd.Version)
	dashFolder.Version = cmd.Version
	dashFolder.UpdatedBy = c.UserId

	// Check if Title is empty
	if dashFolder.Title == "" {
		return ApiError(400, m.ErrFolderTitleEmpty.Error(), nil)
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

func DeleteFolder(c *middleware.Context) Response {
	dashFolder, rsp := getFolderHelper(c.OrgId, "", c.ParamsInt64(":id"))
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
	if folder.UpdatedBy > 0 {
		updater = getUserLogin(folder.UpdatedBy)
	}
	if folder.CreatedBy > 0 {
		creator = getUserLogin(folder.CreatedBy)
	}

	return dtos.Folder{
		Id:        folder.Id,
		Title:     folder.Title,
		Slug:      folder.Slug,
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

	if err == m.ErrDashboardWithSameNameExists {
		return Json(412, util.DynMap{"status": "name-exists", "message": m.ErrFolderWithSameNameExists.Error()})
	}

	if err == m.ErrDashboardVersionMismatch {
		return Json(412, util.DynMap{"status": "version-mismatch", "message": m.ErrFolderVersionMismatch.Error()})
	}

	if err == m.ErrDashboardNotFound {
		return Json(404, util.DynMap{"status": "not-found", "message": m.ErrFolderNotFound.Error()})
	}

	return ApiError(500, "Failed to create folder", err)
}
