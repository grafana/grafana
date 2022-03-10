package store

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var grafanaStorageLogger = log.New("grafanaStorageLogger")

type StorageService interface {
	registry.BackgroundService

	// HTTP API
	Status(c *models.ReqContext) response.Response
	Browse(c *models.ReqContext) response.Response
	Upsert(c *models.ReqContext) response.Response
	Delete(c *models.ReqContext) response.Response
	PostDashboard(c *models.ReqContext) response.Response

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Called from the UI when a dashboard is saved
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)

	// Get the dashboard lookup service
	GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error)

	// Called from the UI when a dashboard is saved
	SaveDashboard(ctx context.Context, user *models.SignedInUser, opts SaveDashboardRequest) (*dtos.DashboardFullWithMeta, error)

	// Writes the entire system to git
	HandleExportSystem(c *models.ReqContext) response.Response

	// Temporary: list items so we can build search index
	ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator
}

type standardStorageService struct {
	sql    *sqlstore.SQLStore
	res    *nestedTree
	dash   *nestedTree
	lookup map[string]*nestedTree
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg *setting.Cfg) StorageService {
	res := &nestedTree{
		roots: []storageRuntime{
			newDiskStorage("public", "Public static files", &StorageLocalDiskConfig{
				Path: cfg.StaticRootPath,
				Roots: []string{
					"/testdata/",
					"/img/icons/",
					"/img/bg/",
					"/gazetteer/",
					"/maps/",
				},
			}).setReadOnly(true).setBuiltin(true),
			newDiskStorage("upload", "Local file upload", &StorageLocalDiskConfig{
				Path: filepath.Join(cfg.DataPath, "upload"),
			}),
		},
	}

	storage := filepath.Join(cfg.DataPath, "storage")
	_ = os.MkdirAll(storage, 0700)

	dash := &nestedTree{
		roots: []storageRuntime{
			newGitStorage("it-A", "Github dashbboards A", storage, &StorageGitConfig{
				Remote:      "https://github.com/grafana/hackathon-2022-03-git-dash-A.git",
				Branch:      "main",
				Root:        "dashboards",
				AccessToken: "",
			}),
			newGitStorage("it-B", "Github dashbboards B", storage, &StorageGitConfig{
				Remote:      "https://github.com/grafana/hackathon-2022-03-git-dash-B.git",
				Branch:      "main",
				Root:        "dashboards",
				AccessToken: "",
			}),
			newS3Storage("s3", "My dashboards in S3", &StorageS3Config{
				Bucket:    "grafana-plugin-resources",
				Folder:    "sub/path/here",
				SecretKey: "***",
				AccessKey: "***",
			}),
		},
	}
	devenv := getDevenvDashboards()
	if devenv != nil {
		dash.roots = append(dash.roots, devenv)
	}

	s := newStandardStorageService(res, dash)
	s.sql = sql
	return s
}

func newStandardStorageService(res *nestedTree, dash *nestedTree) *standardStorageService {
	res.init()
	dash.init()
	return &standardStorageService{
		res:  res,
		dash: dash,
		lookup: map[string]*nestedTree{
			"dash": dash,
			"res":  res,
		},
	}
}

func (s *standardStorageService) Run(ctx context.Context) error {
	fmt.Printf("XXXXXXXXXXXXXXXXX")
	// setup listeners and webhooks?
	return nil
}

func (s *standardStorageService) HandleExportSystem(c *models.ReqContext) response.Response {
	dir, err := os.MkdirTemp("", "dashboard_export_")
	if err != nil {
		return response.Error(500, "init error", err)
	}

	err = exportToRepo(c.Req.Context(), c.OrgId, s.sql, dir)
	if err != nil {
		return response.Error(500, "export error", err)
	}

	return response.JSON(200, map[string]string{"export": dir})
}

func (s *standardStorageService) Status(c *models.ReqContext) response.Response {
	status := make(map[string][]RootStorageMeta)

	meta := make([]RootStorageMeta, 0)
	for _, root := range s.res.roots {
		meta = append(meta, root.Meta())
	}
	status["resources"] = meta

	meta = make([]RootStorageMeta, 0)
	for _, root := range s.dash.roots {
		meta = append(meta, root.Meta())
	}
	status["dashboards"] = meta

	return response.JSON(200, status)
}

func (s *standardStorageService) Upsert(c *models.ReqContext) response.Response {
	action := "Upsert"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (s *standardStorageService) Delete(c *models.ReqContext) response.Response {
	action := "Delete"
	scope, path := getPathAndScope(c)

	return response.JSON(200, map[string]string{
		"action": action,
		"scope":  scope,
		"path":   path,
	})
}

func (s *standardStorageService) Browse(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	frame, err := s.List(c.Req.Context(), c.SignedInUser, path)
	if err != nil {
		return response.Error(400, "error reading path", err)
	}
	if frame == nil {
		return response.Error(404, "not found", nil)
	}
	return response.JSONStreaming(200, frame)
}

func (s *standardStorageService) List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error) {
	if path == "" {
		count := 2
		names := data.NewFieldFromFieldType(data.FieldTypeString, count)
		mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
		names.Name = "name"
		mtype.Name = "mediaType"
		names.Set(0, "dash")
		names.Set(1, "res")
		for i := 0; i < count; i++ {
			mtype.Set(i, "directory")
		}
		frame := data.NewFrame("", names, mtype)
		frame.SetMeta(&data.FrameMeta{
			Type: data.FrameTypeDirectoryListing,
		})
		return frame, nil
	}

	scope, path := splitFirstSegment(path)

	root, ok := s.lookup[scope]
	if !ok {
		return nil, fmt.Errorf("not found")
	}

	// TODO: permission check!

	return root.ListFolder(ctx, path)
}

func (s *standardStorageService) Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error) {
	scope, path := splitFirstSegment(path)

	root, ok := s.lookup[scope]
	if !ok {
		return nil, fmt.Errorf("not found")
	}

	// TODO: permission check!

	return root.GetFile(ctx, path)
}

func (s *standardStorageService) GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error) {
	// TODO: permission check!
	if strings.HasSuffix(path, ".json") {
		return nil, fmt.Errorf("invalid path, do not include .json")
	}

	file, err := s.dash.GetFile(ctx, path+".json")
	if err != nil {
		return nil, err
	}
	if file == nil {
		frame, err := s.dash.ListFolder(ctx, path)
		if frame != nil {
			return s.getFolderDashboard(path, frame)
		}

		return nil, err
	}

	js, err := simplejson.NewJson(file.Contents)
	if err != nil {
		return nil, err
	}

	readonly := false // TODO: depends on ?

	return &dtos.DashboardFullWithMeta{
		Dashboard: js,
		Meta: dtos.DashboardMeta{
			CanSave: !readonly,
			CanEdit: !readonly,
			CanStar: false,
			Slug:    path,
		},
	}, nil
}

type saveDashboardBody struct {
	Dashboard *json.RawMessage `json:"dashboard"`
	Overwrite bool             `json:"overwrite"`
	Message   string           `json:"message"`
}

func (s *standardStorageService) PostDashboard(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	path := params["*"]
	if path == "" || strings.HasSuffix(path, ".json") {
		return response.Error(400, "invalid path", nil)
	}

	cmd := saveDashboardBody{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	req := SaveDashboardRequest{
		Path:    path,
		Body:    *cmd.Dashboard,
		Message: cmd.Message,
	}

	rsp, err := s.SaveDashboard(c.Req.Context(), c.SignedInUser, req)
	if err != nil {
		return response.Error(400, "err", err)
	}

	return response.JSON(200, map[string]interface{}{
		"action":  "SAVE",
		"path":    path,
		"url":     "/g/" + path, // will redirect here
		"version": time.Now().Unix(),
		"out":     rsp,
	})
}

func (s *standardStorageService) getFolderDashboard(path string, frame *data.Frame) (*dtos.DashboardFullWithMeta, error) {
	dash := models.NewDashboard(path)

	fname := frame.Fields[0]
	count := fname.Len()
	if count < 1 {
		return nil, nil
	}

	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	paths := data.NewFieldFromFieldType(data.FieldTypeString, count)
	names.Name = "name"
	paths.Name = "path"

	for i := 0; i < count; i++ {
		name := fmt.Sprintf("%v", fname.At(i))
		name = strings.TrimSuffix(name, ".json")
		names.Set(i, name)
		paths.Set(i, filestorage.Join(path, name))
	}
	f2 := data.NewFrame("", names, paths, frame.Fields[1])
	frame.SetMeta(&data.FrameMeta{
		Type: data.FrameTypeDirectoryListing,
	})

	// HACK alert... stick the listing in the first panel
	panel := map[string]interface{}{
		"__listing": f2,
	}
	arr := []interface{}{panel}
	dash.Data.Set("panels", arr)

	return &dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta: dtos.DashboardMeta{
			Slug:        path,
			FolderUid:   path,
			CanSave:     false,
			CanEdit:     false,
			IsFolder:    true,
			FolderTitle: filepath.Base(path),
		},
	}, nil
}

func (s *standardStorageService) SaveDashboard(ctx context.Context, user *models.SignedInUser, opts SaveDashboardRequest) (*dtos.DashboardFullWithMeta, error) {
	// TODO: authentication!

	var root storageRuntime
	rootKey, path := splitFirstSegment(opts.Path)
	for _, r := range s.dash.roots {
		if r.Meta().Config.Prefix == rootKey {
			root = r
			break
		}
	}
	if root == nil {
		return nil, fmt.Errorf("invalid root")
	}

	// dashboards saved as JSON
	path += ".json"

	// Save pretty JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, opts.Body, "", "  "); err != nil {
		return nil, err
	}
	body := prettyJSON.Bytes()

	err := root.Write(ctx, &writeCommand{
		Path:    path,
		Body:    body,
		Message: opts.Message,
		User:    user,
	})
	if err != nil {
		return nil, err
	}

	// ....

	return nil, err
}

func (s *standardStorageService) ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator {
	return nil // TODO... an iterator
}
