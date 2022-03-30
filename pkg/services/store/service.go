package store

import (
	"context"
	"fmt"
	"io/ioutil"
	"mime/multipart"
	"os"
	"path/filepath"
	"strconv"

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

const RootPublicStatic = "public-static"
const MAX_UPLOAD_SIZE = 1024 * 1024 // 1MB
type StorageService interface {
	registry.BackgroundService

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Read raw file contents out of the store
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)

	Upload(ctx context.Context, user *models.SignedInUser, form *multipart.Form) (*Response, error)
}

type standardStorageService struct {
	sql  *sqlstore.SQLStore
	tree *nestedTree
}

type Response struct {
	path       string
	statusCode int
	message    string
	fileName   string
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
		upload := filepath.Join(storage, "upload")
		_ = os.MkdirAll(upload, 0700)
		roots = append(roots, newDiskStorage("upload", "Local file upload", &StorageLocalDiskConfig{
			Path: upload,
			Roots: []string{
				"/",
			},
		}).setBuiltin(true))
	}
	s := newStandardStorageService(roots)
	s.sql = sql
	return s
}

func newStandardStorageService(roots []storageRuntime) *standardStorageService {
	res := &nestedTree{
		roots: roots,
	}
	res.init()
	return &standardStorageService{
		tree: res,
	}
}

func (s *standardStorageService) Run(ctx context.Context) error {
	grafanaStorageLogger.Info("storage starting")
	return nil
}

func (s *standardStorageService) List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error) {
	// apply access control here
	return s.tree.ListFolder(ctx, path)
}

func (s *standardStorageService) Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error) {
	// TODO: permission check!
	return s.tree.GetFile(ctx, path)
}

func (s *standardStorageService) Upload(ctx context.Context, user *models.SignedInUser, form *multipart.Form) (*Response, error) {
	response := Response{
		path:       "upload",
		statusCode: 200,
		message:    "Uploaded successfully",
	}
	upload, _ := s.tree.getRoot("upload")
	grafanaStorageLogger.Info("upload", "upload", s.tree.lookup)
	if upload == nil {
		return &response, fmt.Errorf("upload feature is not enabled")
	}

	files := form.File["file"]
	for _, fileHeader := range files {
		// Restrict the size of each uploaded file to 1MB.
		// TODO: To prevent the aggregate size from exceeding
		// a specified value, use the http.MaxBytesReader() method
		// before calling ParseMultipartForm()
		if fileHeader.Size > MAX_UPLOAD_SIZE {
			return &response, fmt.Errorf("The uploaded image is too big: %s. Please use an image less than 1MB in size", strconv.FormatInt(fileHeader.Size, 10))
		}
		// open each file to copy contents
		file, err := fileHeader.Open()
		if err != nil {
			response.statusCode = 500
			response.message = "error in opening file to read"
			return &response, err
		}
		defer file.Close()
		data, err := ioutil.ReadAll(file)
		if err != nil {
			response.statusCode = 500
			response.message = "error in reading file"
			return &response, err
		}
		err = upload.Upsert(ctx, &filestorage.UpsertFileCommand{
			Path:     "/" + fileHeader.Filename,
			Contents: &data,
		})
		if err != nil {
			response.statusCode = 500
			response.message = "error in uploading file"
			return &response, err
		}
		response.fileName = fileHeader.Filename
		response.path = "upload/" + fileHeader.Filename
	}
	return &response, nil
}
