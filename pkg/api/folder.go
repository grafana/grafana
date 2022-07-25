package api

import (
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
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetFolders(c *models.ReqContext) response.Response {
	folders, err := hs.folderService.GetFolders(c.Req.Context(), c.SignedInUser, c.OrgId, c.QueryInt64("limit"), c.QueryInt64("page"))

	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	uids := make(map[string]bool, len(folders))
	result := make([]dtos.FolderSearchHit, 0)
	for _, f := range folders {
		uids[f.Uid] = true
		result = append(result, dtos.FolderSearchHit{
			Id:    f.Id,
			Uid:   f.Uid,
			Title: f.Title,
		})
	}

	metadata := hs.getMultiAccessControlMetadata(c, c.OrgId, dashboards.ScopeFoldersPrefix, uids)
	if len(metadata) > 0 {
		for i := range result {
			result[i].AccessControl = metadata[result[i].Uid]
		}
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) GetFolderByUID(c *models.ReqContext) response.Response {
	folder, err := hs.folderService.GetFolderByUID(c.Req.Context(), c.SignedInUser, c.OrgId, web.Params(c.Req)[":uid"])
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.toFolderDto(c, g, folder))
}

func (hs *HTTPServer) GetFolderByID(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	folder, err := hs.folderService.GetFolderByID(c.Req.Context(), c.SignedInUser, id, c.OrgId)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.toFolderDto(c, g, folder))
}

func (hs *HTTPServer) CreateFolder(c *models.ReqContext) response.Response {
	cmd := models.CreateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	folder, err := hs.folderService.CreateFolder(c.Req.Context(), c.SignedInUser, c.OrgId, cmd.Title, cmd.Uid)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}
	if hs.entityEventsService != nil {
		if err := hs.entityEventsService.SaveEvent(c.Req.Context(), store.SaveEventCmd{
			EntityId:  store.CreateDatabaseEntityId(folder.Uid, c.OrgId, store.EntityTypeFolder),
			EventType: store.EntityEventTypeCreate,
		}); err != nil {
			hs.log.Warn("failed to save folder entity event", "uid", folder.Uid, "error", err)
		}
	}

	g := guardian.New(c.Req.Context(), folder.Id, c.OrgId, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.toFolderDto(c, g, folder))
}

func (hs *HTTPServer) UpdateFolder(c *models.ReqContext) response.Response {
	cmd := models.UpdateFolderCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	err := hs.folderService.UpdateFolder(c.Req.Context(), c.SignedInUser, c.OrgId, web.Params(c.Req)[":uid"], &cmd)
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}
	if hs.entityEventsService != nil {
		if err := hs.entityEventsService.SaveEvent(c.Req.Context(), store.SaveEventCmd{
			EntityId:  store.CreateDatabaseEntityId(cmd.Uid, c.OrgId, store.EntityTypeFolder),
			EventType: store.EntityEventTypeUpdate,
		}); err != nil {
			hs.log.Warn("failed to save folder entity event", "uid", cmd.Uid, "error", err)
		}
	}

	g := guardian.New(c.Req.Context(), cmd.Result.Id, c.OrgId, c.SignedInUser)
	return response.JSON(http.StatusOK, hs.toFolderDto(c, g, cmd.Result))
}

func (hs *HTTPServer) DeleteFolder(c *models.ReqContext) response.Response { // temporarily adding this function to HTTPServer, will be removed from HTTPServer when librarypanels featuretoggle is removed
	err := hs.LibraryElementService.DeleteLibraryElementsInFolder(c.Req.Context(), c.SignedInUser, web.Params(c.Req)[":uid"])
	if err != nil {
		if errors.Is(err, libraryelements.ErrFolderHasConnectedLibraryElements) {
			return response.Error(403, "Folder could not be deleted because it contains library elements in use", err)
		}
		return apierrors.ToFolderErrorResponse(err)
	}

	uid := web.Params(c.Req)[":uid"]
	f, err := hs.folderService.DeleteFolder(c.Req.Context(), c.SignedInUser, c.OrgId, uid, c.QueryBool("forceDeleteRules"))
	if err != nil {
		return apierrors.ToFolderErrorResponse(err)
	}
	if hs.entityEventsService != nil {
		if err := hs.entityEventsService.SaveEvent(c.Req.Context(), store.SaveEventCmd{
			EntityId:  store.CreateDatabaseEntityId(uid, c.OrgId, store.EntityTypeFolder),
			EventType: store.EntityEventTypeDelete,
		}); err != nil {
			hs.log.Warn("failed to save folder entity event", "uid", uid, "error", err)
		}
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"title":   f.Title,
		"message": fmt.Sprintf("Folder %s deleted", f.Title),
		"id":      f.Id,
	})
}

func (hs *HTTPServer) toFolderDto(c *models.ReqContext, g guardian.DashboardGuardian, folder *models.Folder) dtos.Folder {
	canEdit, _ := g.CanEdit()
	canSave, _ := g.CanSave()
	canAdmin, _ := g.CanAdmin()
	canDelete, _ := g.CanDelete()

	// Finding creator and last updater of the folder
	updater, creator := anonString, anonString
	if folder.CreatedBy > 0 {
		creator = hs.getUserLogin(c.Req.Context(), folder.CreatedBy)
	}
	if folder.UpdatedBy > 0 {
		updater = hs.getUserLogin(c.Req.Context(), folder.UpdatedBy)
	}

	return dtos.Folder{
		Id:            folder.Id,
		Uid:           folder.Uid,
		Title:         folder.Title,
		Url:           folder.Url,
		HasACL:        folder.HasACL,
		CanSave:       canSave,
		CanEdit:       canEdit,
		CanAdmin:      canAdmin,
		CanDelete:     canDelete,
		CreatedBy:     creator,
		Created:       folder.Created,
		UpdatedBy:     updater,
		Updated:       folder.Updated,
		Version:       folder.Version,
		AccessControl: hs.getAccessControlMetadata(c, c.OrgId, dashboards.ScopeFoldersPrefix, folder.Uid),
	}
}
