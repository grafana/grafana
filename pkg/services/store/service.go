package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/sync/errgroup"

	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
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

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Called from the UI when a dashboard is saved
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)

	// Get the dashboard lookup service
	GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error)

	// Called from the UI when a dashboard is saved
	SaveDashboard(ctx context.Context, user *models.SignedInUser, opts WriteValueRequest) (*WriteValueResponse, error)

	// Temporary: list items so we can build search index
	ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator

	getDashRoot() *nestedTree
}

const RootPublicStatic = "public-static"

type standardStorageService struct {
	sql    *sqlstore.SQLStore
	res    *nestedTree
	dash   *nestedTree
	lookup map[string]*nestedTree
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg *setting.Cfg) StorageService {
	roots := []storageRuntime{
		newDiskStorage(RootPublicStatic, "Public static files", &StorageLocalDiskConfig{
			Path: cfg.StaticRootPath,
			Roots: []string{
				"/testdata/",
				// "/img/icons/",
				// "/img/bg/",
				"/img/",
				"/gazetteer/",
				"/maps/",
			},
		}).setReadOnly(true).setBuiltin(true),
	}
	storage := filepath.Join(cfg.DataPath, "storage")
	_ = os.MkdirAll(storage, 0700)

	if features.IsEnabled(featuremgmt.FlagStorageLocalUpload) {
		roots = append(roots, newDiskStorage("upload", "Local file upload", &StorageLocalDiskConfig{
			Path: filepath.Join(storage, "upload"),
		}))
	}

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

	res := &nestedTree{
		roots: roots,
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
	grafanaStorageLogger.Info("storage starting")
	return nil
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

func (s *standardStorageService) getDashRoot() *nestedTree {
	return s.dash
}
