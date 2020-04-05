package api

import (
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/util"
)

func GetFolders(c *models.ReqContext) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folders, err := s.GetFolders(c.QueryInt64("limit"))

	if err != nil {
		return toFolderError(err)
	}

	result := make([]dtos.FolderSearchHit, 0)

	for _, f := range folders {
		result = append(result, dtos.FolderSearchHit{
			Id:    f.Id,
			Uid:   f.Uid,
			Title: f.Title,
		})
	}

	return JSON(200, result)
}

func GetFolderByUID(c *models.ReqContext) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByUID(c.Params(":uid"))

	if err != nil {
		return toFolderError(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	return JSON(200, toFolderDto(g, folder))
}

func GetFolderByID(c *models.ReqContext) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	folder, err := s.GetFolderByID(c.ParamsInt64(":id"))
	if err != nil {
		return toFolderError(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	return JSON(200, toFolderDto(g, folder))
}

func (hs *HTTPServer) CreateFolder(c *models.ReqContext, cmd models.CreateFolderCommand) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	err := s.CreateFolder(&cmd)
	if err != nil {
		return toFolderError(err)
	}

	if hs.Cfg.EditorsCanAdmin {
		if err := dashboards.MakeUserAdmin(hs.Bus, c.OrgId, c.SignedInUser.UserId, cmd.Result.Id, true); err != nil {
			hs.log.Error("Could not make user admin", "folder", cmd.Result.Title, "user", c.SignedInUser.UserId, "error", err)
		}
	}

	g := guardian.New(cmd.Result.Id, c.OrgId, c.SignedInUser)
	return JSON(200, toFolderDto(g, cmd.Result))
}

func UpdateFolder(c *models.ReqContext, cmd models.UpdateFolderCommand) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	err := s.UpdateFolder(c.Params(":uid"), &cmd)
	if err != nil {
		return toFolderError(err)
	}

	g := guardian.New(cmd.Result.Id, c.OrgId, c.SignedInUser)
	return JSON(200, toFolderDto(g, cmd.Result))
}

func DeleteFolder(c *models.ReqContext) Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser)
	f, err := s.DeleteFolder(c.Params(":uid"))
	if err != nil {
		return toFolderError(err)
	}

	return JSON(200, util.DynMap{
		"title":   f.Title,
		"message": fmt.Sprintf("Folder %s deleted", f.Title),
	})
}

func toFolderDto(g guardian.DashboardGuardian, folder *models.Folder) dtos.Folder {
	canEdit, _ := g.CanEdit()
	canSave, _ := g.CanSave()
	canAdmin, _ := g.CanAdmin()

	// Finding creator and last updater of the folder
	updater, creator := anonString, anonString
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
		Url:       folder.Url,
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
	if err == models.ErrFolderTitleEmpty ||
		err == models.ErrFolderSameNameExists ||
		err == models.ErrFolderWithSameUIDExists ||
		err == models.ErrDashboardTypeMismatch ||
		err == models.ErrDashboardInvalidUid ||
		err == models.ErrDashboardUidToLong {
		return Error(400, err.Error(), nil)
	}

	if err == models.ErrFolderAccessDenied {
		return Error(403, "Access denied", err)
	}

	if err == models.ErrFolderNotFound {
		return JSON(404, util.DynMap{"status": "not-found", "message": models.ErrFolderNotFound.Error()})
	}

	if err == models.ErrFolderVersionMismatch {
		return JSON(412, util.DynMap{"status": "version-mismatch", "message": models.ErrFolderVersionMismatch.Error()})
	}

	return Error(500, "Folder API error", err)
}
