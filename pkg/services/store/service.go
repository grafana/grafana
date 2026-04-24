package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var grafanaStorageLogger = log.New("grafanaStorageLogger")

var ErrUnsupportedStorage = errors.New("storage does not support this operation")
var ErrUploadInternalError = errors.New("upload internal error")
var ErrValidationFailed = errors.New("request validation failed")
var ErrFileAlreadyExists = errors.New("file exists")
var ErrStorageNotFound = errors.New("storage not found")
var ErrAccessDenied = errors.New("access denied")
var ErrOnlyDashboardSaveSupported = errors.New("only dashboard save is currently supported")

const RootPublicStatic = "public-static"
const RootResources = "resources"
const RootContent = "content"
const RootDevenv = "devenv"
const RootSystem = "system"

type UploadRequest struct {
	Contents           []byte
	Path               string
	CacheControl       string
	ContentDisposition string
	Properties         map[string]string
	EntityType         EntityType

	OverwriteExistingFile bool
}

// Deprecated: This service will be removed in the future -- do not write anythign new that depends on it.
// Currently used for:
// - "grafana" datasource, will list static files from the public static root
// - pkg/extensions/report/brandingstorage/storage.go to upload custom branding
type StorageService interface {
	registry.BackgroundService

	// Deprecated: this will be removed in the future
	List(ctx context.Context, user *user.SignedInUser, path string, maxFiles int) (*StorageListFrame, error)

	// Deprecated: this will be removed in the future
	Read(ctx context.Context, user *user.SignedInUser, path string) (*filestorage.File, error)

	// Deprecated: this will be removed in the future
	Upload(ctx context.Context, user *user.SignedInUser, req *UploadRequest) error

	// Deprecated: this will be removed in the future
	Delete(ctx context.Context, user *user.SignedInUser, path string) error
}

type standardStorageService struct {
	sql         db.DB
	tree        *nestedTree
	cfg         *GlobalStorageConfig
	authService storageAuthService
	systemUsers SystemUsersFilterProvider
}

func ProvideService(
	sql db.DB,
	cfg *setting.Cfg,
	systemUsersService SystemUsers,
) (StorageService, error) {
	settings, err := LoadStorageConfig(cfg)
	if err != nil {
		grafanaStorageLogger.Warn("Error loading storage config", "error", err)
	}

	// always exists
	globalRoots := []storageRuntime{
		newDiskStorage(RootStorageMeta{
			ReadOnly: true,
			Builtin:  true,
		}, RootStorageConfig{
			Prefix:      RootPublicStatic,
			Name:        "Public static files",
			Description: "Access files from the static public files",
			Disk: &StorageLocalDiskConfig{
				Path: cfg.StaticRootPath,
				Roots: []string{
					"/testdata/",
					"/img/",
					"/gazetteer/",
					"/maps/",
				},
			},
		}),
	}

	// Development dashboards
	if settings.AddDevEnv && cfg.Env != setting.Prod {
		devenv := filepath.Join(cfg.StaticRootPath, "..", "devenv")
		if _, err := os.Stat(devenv); !os.IsNotExist(err) {
			s := newDiskStorage(RootStorageMeta{
				ReadOnly: false,
			}, RootStorageConfig{
				Prefix:           RootDevenv,
				UnderContentRoot: true,
				Name:             "Development Environment",
				Description:      "Explore files within the developer environment directly",
				Disk: &StorageLocalDiskConfig{
					Path: devenv,
					Roots: []string{
						"/dev-dashboards/",
					},
				}})
			globalRoots = append(globalRoots, s)
		}
	}

	for _, root := range settings.Roots {
		if root.Prefix == "" {
			grafanaStorageLogger.Warn("Invalid root configuration", "cfg", root)
			continue
		}

		// all externally-defined storages lie under the "content" root
		root.UnderContentRoot = true

		// TODO: remove unused second argument
		s, err := newStorage(root, filepath.Join(cfg.DataPath, "storage", "cache", root.Prefix))
		if err != nil {
			grafanaStorageLogger.Warn("Error loading storage config", "error", err)
		}
		if s != nil {
			globalRoots = append(globalRoots, s)
		}
	}

	initializeOrgStorages := func(orgId int64) []storageRuntime {
		storages := make([]storageRuntime, 0, 3)

		storages = append(storages,
			newSQLStorage(RootStorageMeta{
				Builtin: true,
			}, RootContent, "Content", "Content root", &StorageSQLConfig{}, sql, orgId, false))

		// Custom upload files
		storages = append(storages,
			newSQLStorage(RootStorageMeta{
				Builtin: true,
			}, RootResources, "Resources", "Upload custom resource files", &StorageSQLConfig{}, sql, orgId, false))

		// System settings
		storages = append(storages,
			newSQLStorage(RootStorageMeta{
				Builtin: true,
			}, RootSystem, "System", "Grafana system storage", &StorageSQLConfig{}, sql, orgId, false))

		return storages
	}

	globalRoots = append(globalRoots, initializeOrgStorages(ac.GlobalOrgID)...)

	authService := newStaticStorageAuthService(func(ctx context.Context, user *user.SignedInUser, storageName string) map[string]filestorage.PathFilter {
		// Public is OK to read regardless of user settings
		if storageName == RootPublicStatic {
			return map[string]filestorage.PathFilter{
				ActionFilesRead:   allowAllPathFilter,
				ActionFilesWrite:  denyAllPathFilter,
				ActionFilesDelete: denyAllPathFilter,
			}
		}

		if user == nil {
			return nil
		}

		if storageName == RootSystem {
			filter, err := systemUsersService.GetFilter(user)
			if err != nil {
				grafanaStorageLogger.Error("Failed to create path filter for system user", "userID", user.UserID, "userLogin", user.Login, "err", err)
				return map[string]filestorage.PathFilter{
					ActionFilesRead:   denyAllPathFilter,
					ActionFilesWrite:  denyAllPathFilter,
					ActionFilesDelete: denyAllPathFilter,
				}
			}

			return filter
		}

		if storageName == RootContent {
			if user.OrgRole != org.RoleAdmin {
				// read only
				return map[string]filestorage.PathFilter{
					ActionFilesRead:   allowAllPathFilter,
					ActionFilesWrite:  denyAllPathFilter,
					ActionFilesDelete: denyAllPathFilter,
				}
			}

			// read/write for all except for devenv
			writeFilter := filestorage.NewPathFilter(
				[]string{filestorage.Delimiter}, // access to everything
				nil,
				[]string{filestorage.Delimiter + RootDevenv + filestorage.Delimiter}, // except devenv
				[]string{filestorage.Delimiter + RootDevenv})

			return map[string]filestorage.PathFilter{
				ActionFilesRead:   allowAllPathFilter,
				ActionFilesWrite:  writeFilter,
				ActionFilesDelete: writeFilter,
			}
		}

		if !user.IsGrafanaAdmin {
			return nil
		}

		// Admin can do anything
		return map[string]filestorage.PathFilter{
			ActionFilesRead:   allowAllPathFilter,
			ActionFilesWrite:  allowAllPathFilter,
			ActionFilesDelete: allowAllPathFilter,
		}
	})

	s := newStandardStorageService(sql, globalRoots, initializeOrgStorages, authService, cfg, systemUsersService)
	s.cfg = settings

	return s, nil
}

func newStandardStorageService(
	sql db.DB,
	globalRoots []storageRuntime,
	initializeOrgStorages func(orgId int64) []storageRuntime,
	authService storageAuthService,
	cfg *setting.Cfg,
	systemUsers SystemUsersFilterProvider,
) *standardStorageService {
	prefixes := make(map[string]bool)

	for _, root := range globalRoots {
		currentPrefix := root.Meta().Config.Prefix
		if _, ok := prefixes[currentPrefix]; ok {
			panic("non-unique storage prefix: " + currentPrefix)
		}

		prefixes[currentPrefix] = true
	}

	rootsByOrgId := make(map[int64][]storageRuntime)
	rootsByOrgId[ac.GlobalOrgID] = globalRoots

	res := &nestedTree{
		initializeOrgStorages: initializeOrgStorages,
		rootsByOrgId:          rootsByOrgId,
	}
	res.init()
	return &standardStorageService{
		sql:         sql,
		tree:        res,
		authService: authService,
		systemUsers: systemUsers,
	}
}

func (s *standardStorageService) Run(ctx context.Context) error {
	grafanaStorageLogger.Info("Storage starting")
	return nil
}

func getOrgId(user *user.SignedInUser) int64 {
	if user == nil {
		return ac.GlobalOrgID
	}

	return user.OrgID
}

func (s *standardStorageService) List(ctx context.Context, user *user.SignedInUser, path string, maxFiles int) (*StorageListFrame, error) {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(path))
	return s.tree.ListFolder(ctx, getOrgId(user), path, maxFiles, guardian.getPathFilter(ActionFilesRead))
}

func (s *standardStorageService) Read(ctx context.Context, user *user.SignedInUser, path string) (*filestorage.File, error) {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(path))
	if !guardian.canView(path) {
		return nil, ErrAccessDenied
	}
	return s.tree.GetFile(ctx, getOrgId(user), path)
}

func (s *standardStorageService) Upload(ctx context.Context, user *user.SignedInUser, req *UploadRequest) error {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(req.Path))
	if !guardian.canWrite(req.Path) {
		return ErrAccessDenied
	}

	root, storagePath := s.tree.getRoot(getOrgId(user), req.Path)
	if root == nil {
		return ErrStorageNotFound
	}

	if root.Meta().ReadOnly {
		return ErrUnsupportedStorage
	}

	validationResult := s.validateUploadRequest(ctx, user, req, storagePath)
	if !validationResult.ok {
		grafanaStorageLogger.Warn("File upload validation failed", "path", req.Path, "reason", validationResult.reason)
		return ErrValidationFailed
	}

	upsertCommand, err := s.sanitizeUploadRequest(ctx, user, req, storagePath)
	if err != nil {
		grafanaStorageLogger.Error("Failed while sanitizing the upload request", "path", req.Path, "error", err)
		return ErrUploadInternalError
	}

	grafanaStorageLogger.Info("Uploading a file", "path", req.Path)

	if !req.OverwriteExistingFile {
		file, _, err := root.Store().Get(ctx, storagePath, &filestorage.GetFileOptions{WithContents: false})
		if err != nil {
			grafanaStorageLogger.Error("Failed while checking file existence", "err", err, "path", req.Path)
			return ErrUploadInternalError
		}

		if file != nil {
			return ErrFileAlreadyExists
		}
	}

	if err := root.Store().Upsert(ctx, upsertCommand); err != nil {
		grafanaStorageLogger.Error("Failed while uploading the file", "err", err, "path", req.Path)
		return ErrUploadInternalError
	}

	return nil
}

func (s *standardStorageService) Delete(ctx context.Context, user *user.SignedInUser, path string) error {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(path))
	if !guardian.canDelete(path) {
		return ErrAccessDenied
	}

	root, storagePath := s.tree.getRoot(getOrgId(user), path)
	if root == nil {
		return ErrStorageNotFound
	}

	if root.Meta().ReadOnly {
		return ErrUnsupportedStorage
	}

	err := root.Store().Delete(ctx, storagePath)
	if err != nil {
		return err
	}
	return nil
}
