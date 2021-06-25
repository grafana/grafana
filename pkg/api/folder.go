package api

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) GetFolders(c *models.ReqContext) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folders, err := s.GetFolders(c.QueryInt64("limit"))

	if err != nil {
		return ToFolderErrorResponse(err)
	}

	result := make([]dtos.FolderSearchHit, 0)

	for _, f := range folders {
		result = append(result, dtos.FolderSearchHit{
			Id:    f.Id,
			Uid:   f.Uid,
			Title: f.Title,
		})
	}

	return response.JSON(200, result)
}

func (hs *HTTPServer) GetFolderByUID(c *models.ReqContext) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folder, err := s.GetFolderByUID(c.Params(":uid"))
	if err != nil {
		return ToFolderErrorResponse(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) GetFolderByID(c *models.ReqContext) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folder, err := s.GetFolderByID(c.ParamsInt64(":id"))
	if err != nil {
		return ToFolderErrorResponse(err)
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) CreateFolder(c *models.ReqContext, cmd models.CreateFolderCommand) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folder, err := s.CreateFolder(cmd.Title, cmd.Uid)
	if err != nil {
		return ToFolderErrorResponse(err)
	}

	if hs.Cfg.EditorsCanAdmin {
		if err := s.MakeUserAdmin(c.OrgId, c.SignedInUser.UserId, folder.Id, true); err != nil {
			hs.log.Error("Could not make user admin", "folder", folder.Title, "user",
				c.SignedInUser.UserId, "error", err)
		}
	}

	g := guardian.New(folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) UpdateFolder(c *models.ReqContext, cmd models.UpdateFolderCommand) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	err := s.UpdateFolder(c.Params(":uid"), &cmd)
	if err != nil {
		return ToFolderErrorResponse(err)
	}

	g := guardian.New(cmd.Result.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, cmd.Result))
}

func (hs *HTTPServer) DeleteFolder(c *models.ReqContext) response.Response { // temporarily adding this function to HTTPServer, will be removed from HTTPServer when librarypanels featuretoggle is removed
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	err := hs.LibraryElementService.DeleteLibraryElementsInFolder(c, c.Params(":uid"))
	if err != nil {
		if errors.Is(err, libraryelements.ErrFolderHasConnectedLibraryElements) {
			return response.Error(403, "Folder could not be deleted because it contains library elements in use", err)
		}
		return ToFolderErrorResponse(err)
	}

	f, err := s.DeleteFolder(c.Params(":uid"))
	if err != nil {
		return ToFolderErrorResponse(err)
	}

	return response.JSON(200, util.DynMap{
		"title":   f.Title,
		"message": fmt.Sprintf("Folder %s deleted", f.Title),
		"id":      f.Id,
	})
}

func toFolderDto(ctx context.Context, g guardian.DashboardGuardian, folder *models.Folder) dtos.Folder {
	canEdit, _ := g.CanEdit()
	canSave, _ := g.CanSave()
	canAdmin, _ := g.CanAdmin()

	// Finding creator and last updater of the folder
	updater, creator := anonString, anonString
	if folder.CreatedBy > 0 {
		creator = getUserLogin(ctx, folder.CreatedBy)
	}
	if folder.UpdatedBy > 0 {
		updater = getUserLogin(ctx, folder.UpdatedBy)
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

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	var dashboardErr models.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, err.Error(), err)
	}

	if errors.Is(err, models.ErrFolderTitleEmpty) ||
		errors.Is(err, models.ErrFolderSameNameExists) ||
		errors.Is(err, models.ErrFolderWithSameUIDExists) ||
		errors.Is(err, models.ErrDashboardTypeMismatch) ||
		errors.Is(err, models.ErrDashboardInvalidUid) ||
		errors.Is(err, models.ErrDashboardUidTooLong) {
		return response.Error(400, err.Error(), nil)
	}

	if errors.Is(err, models.ErrFolderAccessDenied) {
		return response.Error(403, "Access denied", err)
	}

	if errors.Is(err, models.ErrFolderNotFound) {
		return response.JSON(404, util.DynMap{"status": "not-found", "message": models.ErrFolderNotFound.Error()})
	}

	if errors.Is(err, models.ErrFolderVersionMismatch) {
		return response.JSON(412, util.DynMap{"status": "version-mismatch", "message": models.ErrFolderVersionMismatch.Error()})
	}

	return response.Error(500, "Folder API error", err)
}
