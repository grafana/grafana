package api

import (
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/web"
)

func getPathAndScope(c *models.ReqContext) (string, string) {
	params := web.Params(c.Req)
	path := params["*"]
	if path == "" {
		return "", ""
	}
	return store.SplitFirstSegment(filepath.Clean(path))
}

func (hs *HTTPServer) UploadStorage(c *models.ReqContext) response.Response {
	action := "Upload"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (hs *HTTPServer) DeleteStorage(c *models.ReqContext) response.Response {
	action := "Delete"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (hs *HTTPServer) BrowseStorage(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	frame, err := hs.StorageService.List(c.Req.Context(), c.SignedInUser, path)
	if err != nil {
		return response.Error(400, "error reading path", err)
	}
	if frame == nil {
		return response.Error(404, "not found", nil)
	}
	return response.JSONStreaming(200, frame)
}
