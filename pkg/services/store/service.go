package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var grafanaStorageLogger = log.New("grafanaStorageLogger")

type StorageService interface {
	registry.BackgroundService

	// Management
	Status(c *models.ReqContext) response.Response
	Browse(c *models.ReqContext) response.Response
	Upsert(c *models.ReqContext) response.Response
	Delete(c *models.ReqContext) response.Response

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
	sql      *sqlstore.SQLStore
	datapath string

	// Scopes
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
					"testdata/",
					"img/icons/",
					"img/bg/",
					"gazetteer/",
					"maps/",
					"upload/",
				},
			}).setReadOnly(true).setBuiltin(true),
			newDiskStorage("upload", "Local file upload", &StorageLocalDiskConfig{
				Path: filepath.Join(cfg.DataPath, "upload"),
			}),
		},
	}

	devenv, _ := filepath.Abs("devenv")
	dash := &nestedTree{
		roots: []storageRuntime{
			newDiskStorage("dev-dashboards", "devenv dashboards", &StorageLocalDiskConfig{
				Path: filepath.Join(devenv, "dev-dashboards"),
			}),
			newGitStorage("it", "My dashboards in git", &StorageGitConfig{
				Remote:      "git@github.com:ryantxu/test-dash-repo.git",
				Branch:      "main",
				Root:        "path/to/subfolder",
				AccessToken: "should be more secrete",
			}),
			newS3Storage("s3", "My dashboards in S3", &StorageS3Config{
				Bucket:    "grafana-plugin-resources",
				Folder:    "sub/path/here",
				SecretKey: "***",
				AccessKey: "***",
			}),
		},
	}

	res.init()
	dash.init()

	return &standardStorageService{
		sql:      sql,
		datapath: cfg.DataPath,

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
	scope, path := getPathAndScope(c)
	if scope == "" && path == "" {
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
		return response.JSONStreaming(200, frame)
	}

	root, ok := s.lookup[scope]
	if !ok {
		return response.Error(400, fmt.Sprintf("unknown scope(%s, %s)", scope, path), nil)
	}

	// TODO: permission check!

	frame, err := root.ListFolder(c.Req.Context(), path)
	if err != nil {
		return response.Error(400, "error reading path", err)
	}
	if frame == nil {
		return response.Error(404, "not found", nil)
	}
	return response.JSONStreaming(200, frame)
}

func (s *standardStorageService) GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error) {
	return nil, nil
}

func (s *standardStorageService) SaveDashboard(ctx context.Context, user *models.SignedInUser, opts SaveDashboardRequest) (*dtos.DashboardFullWithMeta, error) {
	return nil, nil
}

func (s *standardStorageService) ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator {
	return nil // TODO... an iterator
}
