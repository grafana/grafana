package store

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/grafana/grafana/pkg/api/dtos"
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

	// git-the-things-hack
	Status(c *models.ReqContext) response.Response
	PostDashboard(c *models.ReqContext) response.Response
	HandleRootRequest(c *models.ReqContext) response.Response
	HandleExportSystem(c *models.ReqContext) response.Response
	GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error)
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
	action := "Upload"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
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

func (s *httpStorage) HandleExportSystem(c *models.ReqContext) response.Response {
	dir, err := os.MkdirTemp("", "dashboard_export_")
	if err != nil {
		return response.Error(500, "init error", err)
	}

	// err = exportToRepo(c.Req.Context(), c.OrgId, s.store.sql, dir)
	// if err != nil {
	// 	return response.Error(500, "export error", err)
	// }

	return response.JSON(200, map[string]string{"export": dir})
}

func (s *httpStorage) Status(c *models.ReqContext) response.Response {
	status := make(map[string][]RootStorageMeta)

	// meta := make([]RootStorageMeta, 0)
	// for _, root := range s.store.res.roots {
	// 	meta = append(meta, root.Meta())
	// }
	// status["resources"] = meta

	// meta = make([]RootStorageMeta, 0)
	// for _, root := range s.store.dash.roots {
	// 	meta = append(meta, root.Meta())
	// }
	// status["dashboards"] = meta

	return response.JSON(200, status)
}

func (s *httpStorage) HandleRootRequest(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	key := params[":key"]
	action := c.Req.URL.Query().Get("action")
	isPost := c.Req.Method == "POST"

	var root storageRuntime
	for _, r := range s.store.getDashRoot().roots { // HACK!
		m := r.Meta()
		if m.Config.Prefix == key {
			root = r
			break
		}
	}

	if root == nil {
		return response.Error(400, "unknown root", nil)
	}

	if action != "" && !isPost {
		return response.Error(400, "action requires POST", nil)
	}

	switch action {
	case "sync":
		err := root.Sync()
		if err != nil {
			return response.Error(400, "sync error: "+err.Error(), nil)
		}
		return response.Success("OK")

	case "":
		return response.JSON(200, root.Meta())
	}

	return response.JSON(400, map[string]string{
		"error":  "unknown action",
		"action": action,
		"key":    key,
		"method": c.Req.Method,
	})
}

// simple pass through
func (s *httpStorage) GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error) {
	return s.store.GetDashboard(ctx, user, path)
}

func (s *httpStorage) PostDashboard(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	if path == "" || strings.HasSuffix(path, ".json") {
		return response.Error(400, "invalid path", nil)
	}

	cmd := WriteValueRequest{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if len(cmd.Body) < 2 {
		return response.Error(400, "missing body JSON", nil)
	}

	cmd.Path = path
	cmd.User = c.SignedInUser

	rsp, err := s.store.SaveDashboard(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(500, "error saving dashboard", err)
	}
	if rsp.Code < 100 || rsp.Code > 700 {
		rsp.Code = 500
	}
	return response.JSONStreaming(rsp.Code, rsp)
}
