package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sync/errgroup"

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
	HandleRootRequest(c *models.ReqContext) response.Response

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Called from the UI when a dashboard is saved
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)

	// Get the dashboard lookup service
	GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error)

	// Called from the UI when a dashboard is saved
	SaveDashboard(ctx context.Context, user *models.SignedInUser, opts WriteValueRequest) (*WriteValueResponse, error)

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

	devenv := getDevenvDashboards()
	dash := &nestedTree{
		roots: []storageRuntime{
			newGitStorage("it-A", "Github dashbboards A (Require pull requests)", storage, &StorageGitConfig{
				Remote:             "https://github.com/grafana/hackathon-2022-03-git-dash-A.git",
				Branch:             "main",
				Root:               "dashboards",
				AccessToken:        "$GITHUB_AUTH_TOKEN",
				RequirePullRequest: true,
			}),
			newGitStorage("it-B", "Github dashbboards B (Commit to main)", storage, &StorageGitConfig{
				Remote:      "https://github.com/grafana/hackathon-2022-03-git-dash-B.git",
				Branch:      "main",
				Root:        "dashboards",
				AccessToken: "$GITHUB_AUTH_TOKEN",
			}),
			newS3Storage("s3", "S3 dashboards", &StorageS3Config{
				Bucket:    "s3-dashbucket",
				Folder:    "dashboards",
				SecretKey: "$STORAGE_AWS_SECRET_KEY",
				AccessKey: "$STORAGE_AWS_ACCESS_KEY",
				Region:    "$STORAGE_AWS_REGION",
			}),
			newGCSstorage("gcs", "GCS dashboards", &StorageGCSConfig{
				Bucket:          "git-the-things-gcs",
				Folder:          "dashboards",
				CredentialsFile: "$STORAGE_GCS_CREDENTIALS_FILE",
			}),
			newSQLStorage("sql", "SQL within grafana database", &StorageSQLConfig{}, sql, devenv),
		},
	}
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

func (s *standardStorageService) HandleRootRequest(c *models.ReqContext) response.Response {
	params := web.Params(c.Req)
	key := params[":key"]
	action := c.Req.URL.Query().Get("action")
	isPost := c.Req.Method == "POST"

	var root storageRuntime
	for _, r := range s.dash.roots { // HACK!
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

	var file *filestorage.File
	var frame *data.Frame
	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		f, err := s.dash.GetFile(ctx, path+".json")
		file = f
		return err
	})
	g.Go(func() error {
		f, err := s.dash.ListFolder(ctx, path)
		frame = f
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, err
	}

	if file == nil {
		if frame != nil {
			return s.getFolderDashboard(path, frame)
		}

		return nil, errors.New("failed to load dashboard")
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

func (s *standardStorageService) PostDashboard(c *models.ReqContext) response.Response {
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

	rsp, err := s.SaveDashboard(c.Req.Context(), c.SignedInUser, cmd)
	if err != nil {
		return response.Error(500, "error saving dashboard", err)
	}
	if rsp.Code < 100 || rsp.Code > 700 {
		rsp.Code = 500
	}
	return response.JSONStreaming(rsp.Code, rsp)
}

func (s *standardStorageService) getFolderDashboard(path string, frame *data.Frame) (*dtos.DashboardFullWithMeta, error) {
	dash := models.NewDashboard(path)

	var fname *data.Field
	var ftype *data.Field
	var ftitle *data.Field
	for _, f := range frame.Fields {
		if f.Name == "title" {
			ftitle = f
		}
		if f.Name == "mediaType" {
			ftype = f
		}
		if f.Name == "name" {
			fname = f
		}
	}

	if fname == nil || ftype == nil {
		return nil, nil
	}

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
		paths.Set(i, filestorage.Join(path, name))
		names.Set(i, name)

		if ftitle != nil {
			names.Set(i, ftitle.At(i))
		}
	}
	f2 := data.NewFrame("", names, paths, ftype)
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

func (s *standardStorageService) SaveDashboard(ctx context.Context, user *models.SignedInUser, opts WriteValueRequest) (*WriteValueResponse, error) {
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

	// Save pretty JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, opts.Body, "", "  "); err != nil {
		return nil, err
	}

	// dashboards saved as JSON
	opts.Path = path + ".json"
	opts.Body = prettyJSON.Bytes()

	return root.Write(ctx, &opts)
}

func (s *standardStorageService) ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator {
	return nil // TODO... an iterator
}
