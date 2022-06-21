package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var grafanaStorageLogger = log.New("grafanaStorageLogger")

var ErrUploadFeatureDisabled = errors.New("upload feature is disabled")
var ErrUnsupportedStorage = errors.New("storage does not support upload operation")
var ErrUploadInternalError = errors.New("upload internal error")
var ErrValidationFailed = errors.New("request validation failed")
var ErrFileAlreadyExists = errors.New("file exists")

const RootPublicStatic = "public-static"
const RootUpload = "upload"

const MAX_UPLOAD_SIZE = 1024 * 1024 // 1MB

type StorageService interface {
	registry.BackgroundService

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Read raw file contents out of the store
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)

	Upload(ctx context.Context, user *models.SignedInUser, req *UploadRequest) error

	Delete(ctx context.Context, user *models.SignedInUser, path string) error

	validateUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) validationResult

	// sanitizeUploadRequest sanitizes the upload request and converts it into a command accepted by the FileStorage API
	sanitizeUploadRequest(ctx context.Context, user *models.SignedInUser, req *UploadRequest, storagePath string) (*filestorage.UpsertFileCommand, error)
}

type standardStorageService struct {
	sql  *sqlstore.SQLStore
	tree *nestedTree
}

func ProvideService(sql *sqlstore.SQLStore, features featuremgmt.FeatureToggles, cfg *setting.Cfg) StorageService {
	globalRoots := []storageRuntime{
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

	initializeOrgStorages := func(orgId int64) []storageRuntime {
		storages := make([]storageRuntime, 0)
		if features.IsEnabled(featuremgmt.FlagStorageLocalUpload) {
			config := &StorageSQLConfig{orgId: orgId}
			storages = append(storages, newSQLStorage(RootUpload, "Local file upload", config, sql).setBuiltin(true))
		}
		return storages
	}

	s := newStandardStorageService(globalRoots, initializeOrgStorages)
	s.sql = sql
	return s
}

func newStandardStorageService(globalRoots []storageRuntime, initializeOrgStorages func(orgId int64) []storageRuntime) *standardStorageService {
	rootsByOrgId := make(map[int64][]storageRuntime)
	rootsByOrgId[ac.GlobalOrgID] = globalRoots

	res := &nestedTree{
		initializeOrgStorages: initializeOrgStorages,
		rootsByOrgId:          rootsByOrgId,
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

func getOrgId(user *models.SignedInUser) int64 {
	if user == nil {
		return ac.GlobalOrgID
	}

	return user.OrgId
}

func (s *standardStorageService) List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error) {
	// apply access control here
	return s.tree.ListFolder(ctx, getOrgId(user), path)
}

func (s *standardStorageService) Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error) {
	// TODO: permission check!
	return s.tree.GetFile(ctx, getOrgId(user), path)
}

type UploadRequest struct {
	Contents           []byte
	MimeType           string // TODO: remove MimeType from the struct once we can infer it from file contents
	Path               string
	CacheControl       string
	ContentDisposition string
	Properties         map[string]string
	EntityType         EntityType

	OverwriteExistingFile bool
}

func (s *standardStorageService) Upload(ctx context.Context, user *models.SignedInUser, req *UploadRequest) error {
	upload, _ := s.tree.getRoot(getOrgId(user), RootUpload)
	if upload == nil {
		return ErrUploadFeatureDisabled
	}

	if !strings.HasPrefix(req.Path, RootUpload+"/") {
		return ErrUnsupportedStorage
	}

	storagePath := strings.TrimPrefix(req.Path, RootUpload)
	validationResult := s.validateUploadRequest(ctx, user, req, storagePath)
	if !validationResult.ok {
		grafanaStorageLogger.Warn("file upload validation failed", "filetype", req.MimeType, "path", req.Path, "reason", validationResult.reason)
		return ErrValidationFailed
	}

	upsertCommand, err := s.sanitizeUploadRequest(ctx, user, req, storagePath)
	if err != nil {
		grafanaStorageLogger.Error("failed while sanitizing the upload request", "filetype", req.MimeType, "path", req.Path, "error", err)
		return ErrUploadInternalError
	}

	grafanaStorageLogger.Info("uploading a file", "filetype", req.MimeType, "path", req.Path)

	if !req.OverwriteExistingFile {
		file, err := upload.Get(ctx, storagePath)
		if err != nil {
			grafanaStorageLogger.Error("failed while checking file existence", "err", err, "path", req.Path)
			return ErrUploadInternalError
		}

		if file != nil {
			return ErrFileAlreadyExists
		}
	}

	if err := upload.Upsert(ctx, upsertCommand); err != nil {
		grafanaStorageLogger.Error("failed while uploading the file", "err", err, "path", req.Path)
		return ErrUploadInternalError
	}

	return nil
}

func (s *standardStorageService) Delete(ctx context.Context, user *models.SignedInUser, path string) error {
	upload, _ := s.tree.getRoot(getOrgId(user), RootUpload)
	if upload == nil {
		return fmt.Errorf("upload feature is not enabled")
	}
	err := upload.Delete(ctx, path)
	if err != nil {
		return err
	}
	return nil
}
