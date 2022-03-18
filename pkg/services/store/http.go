package store

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

// HTTPStorageService passes raw HTTP requests to a well typed storage service
type HTTPStorageService interface {
	List(c *models.ReqContext) response.Response
	Read(c *models.ReqContext) response.Response
	Delete(c *models.ReqContext) response.Response
	Upload(c *models.ReqContext) response.Response
}

type httpStorage struct {
	store StorageService
}

func ProvideHTTPService(store StorageService) HTTPStorageService {
	return &httpStorage{
		store: store,
	}
}

func (s *httpStorage) Upload(c *models.ReqContext) response.Response {

	// 32 MB is the default used by FormFile()
	if err := c.Req.ParseMultipartForm(32 << 20); err != nil {
		grafanaStorageLogger.Error("error in parsing form", err)
		return response.Error(400, "error parsing form", err)
	}
	if err := s.store.Upload(c.Req.Context(), c.SignedInUser, c.Req.MultipartForm); err != nil {
		return response.Error(400, "cannot call upload", err)
	}

	return response.JSON(200, map[string]string{
		"action": "hello world",
	})
}

func (s *httpStorage) Read(c *models.ReqContext) response.Response {
	action := "Read"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (s *httpStorage) Delete(c *models.ReqContext) response.Response {
	action := "Delete"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (s *httpStorage) List(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	frame, err := s.store.List(c.Req.Context(), c.SignedInUser, path)
	if err != nil {
		return response.Error(400, "error reading path", err)
	}
	if frame == nil {
		return response.Error(404, "not found", nil)
	}
	return response.JSONStreaming(200, frame)
}
