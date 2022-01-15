package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetFolders(c *models.ReqContext) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folders, err := s.GetFolders(c.Req.Context(), c.QueryInt64("limit"), c.QueryInt64("page"))

	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
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
	folder, err := s.GetFolderByUID(c.Req.Context(), web.Params(c.Req)[":uid"])
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) GetFolderByID(c *models.ReqContext) response.Response {
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)

	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	folder, err := s.GetFolderByID(c.Req.Context(), id)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) CreateFolder(c *models.ReqContext) response.Response {
	cmd := models.CreateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	folder, err := s.CreateFolder(c.Req.Context(), cmd.Title, cmd.Uid)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	if hs.Cfg.EditorsCanAdmin {
		if err := s.MakeUserAdmin(c.Req.Context(), c.OrgId, c.SignedInUser.UserId, folder.Id, true); err != nil {
			hs.log.Error("Could not make user admin", "folder", folder.Title, "user",
				c.SignedInUser.UserId, "error", err)
		}
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, folder))
}

func (hs *HTTPServer) UpdateFolder(c *models.ReqContext) response.Response {
	cmd := models.UpdateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	err := s.UpdateFolder(c.Req.Context(), web.Params(c.Req)[":uid"], &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), cmd.Result.Id, c.OrgId, c.SignedInUser)
	return response.JSON(200, toFolderDto(c.Req.Context(), g, cmd.Result))
}

func (hs *HTTPServer) DeleteFolder(c *models.ReqContext) response.Response { // temporarily adding this function to HTTPServer, will be removed from HTTPServer when librarypanels featuretoggle is removed
	s := dashboards.NewFolderService(c.OrgId, c.SignedInUser, hs.SQLStore)
	err := hs.LibraryElementService.DeleteLibraryElementsInFolder(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		if errors.Is(err, libraryelements.ErrFolderHasConnectedLibraryElements) {
			return response.Error(403, "Folder could not be deleted because it contains library elements in use", err)
		}
		return apierrors.ToFolderErrorResponse(err)
	}

	f, err := s.DeleteFolder(c.Req.Context(), web.Params(c.Req)[":uid"], c.QueryBool("forceDeleteRules"))
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
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
