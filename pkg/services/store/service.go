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
var ErrUnsupportedFolder = errors.New("unsupported folder for uploads")
var ErrFileTooBig = errors.New("file is too big")
var ErrInvalidPath = errors.New("path is invalid")
var ErrUploadInternalError = errors.New("upload internal error")
var ErrInvalidFileType = errors.New("invalid file type")
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

	Upload(ctx context.Context, user *models.SignedInUser, req UploadRequest) error

	Delete(ctx context.Context, user *models.SignedInUser, path string) error
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

func isFileTypeValid(filetype string) bool {
	if (filetype == "image/jpeg") || (filetype == "image/jpg") || (filetype == "image/gif") || (filetype == "image/png") || (filetype == "image/webp") {
		return true
	}
	return false
}

type UploadRequest struct {
	Contents           []byte
	MimeType           string
	Path               string
	CacheControl       string
	ContentDisposition string
	Properties         map[string]string

	OverwriteExistingFile bool
}

func (s *standardStorageService) Upload(ctx context.Context, user *models.SignedInUser, req UploadRequest) error {
	upload, _ := s.tree.getRoot(getOrgId(user), RootUpload)
	if upload == nil {
		return ErrUploadFeatureDisabled
	}

	if !strings.HasPrefix(req.Path, RootUpload+"/") {
		return ErrUnsupportedFolder
	}

	validFileType := isFileTypeValid(req.MimeType)
	if !validFileType {
		return ErrInvalidFileType
	}

	grafanaStorageLogger.Info("uploading a file", "filetype", req.MimeType, "path", req.Path)

	storagePath := strings.TrimPrefix(req.Path, RootUpload)

	if err := filestorage.ValidatePath(storagePath); err != nil {
		grafanaStorageLogger.Info("uploading file failed due to invalid path", "filetype", req.MimeType, "path", req.Path, "err", err)
		return ErrInvalidPath
	}

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

	err := upload.Upsert(ctx, &filestorage.UpsertFileCommand{
		Path:               storagePath,
		Contents:           req.Contents,
		MimeType:           req.MimeType,
		CacheControl:       req.CacheControl,
		ContentDisposition: req.ContentDisposition,
		Properties:         req.Properties,
	})

	if err != nil {
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
