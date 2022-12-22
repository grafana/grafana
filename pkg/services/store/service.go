package store

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var grafanaStorageLogger = log.New("grafanaStorageLogger")

var ErrUnsupportedStorage = errors.New("storage does not support this operation")
var ErrUploadInternalError = errors.New("upload internal error")
var ErrQuotaReached = errors.New("file quota reached")
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

const MAX_UPLOAD_SIZE = 1 * 1024 * 1024 // 3MB

type DeleteFolderCmd struct {
	Path  string `json:"path"`
	Force bool   `json:"force"`
}

type CreateFolderCmd struct {
	Path string `json:"path"`
}

const (
	QuotaTargetSrv quota.TargetSrv = "store"
	QuotaTarget    quota.Target    = "file"
)

type StorageService interface {
	registry.BackgroundService

	// Register the HTTP
	RegisterHTTPRoutes(routing.RouteRegister)

	// List folder contents
	List(ctx context.Context, user *user.SignedInUser, path string) (*StorageListFrame, error)

	// Read raw file contents out of the store
	Read(ctx context.Context, user *user.SignedInUser, path string) (*filestorage.File, error)

	Upload(ctx context.Context, user *user.SignedInUser, req *UploadRequest) error

	Delete(ctx context.Context, user *user.SignedInUser, path string) error

	DeleteFolder(ctx context.Context, user *user.SignedInUser, cmd *DeleteFolderCmd) error

	CreateFolder(ctx context.Context, user *user.SignedInUser, cmd *CreateFolderCmd) error

	validateUploadRequest(ctx context.Context, user *user.SignedInUser, req *UploadRequest, storagePath string) validationResult

	// sanitizeUploadRequest sanitizes the upload request and converts it into a command accepted by the FileStorage API
	sanitizeUploadRequest(ctx context.Context, user *user.SignedInUser, req *UploadRequest, storagePath string) (*filestorage.UpsertFileCommand, error)
}

type standardStorageService struct {
	sql          db.DB
	tree         *nestedTree
	cfg          *GlobalStorageConfig
	authService  storageAuthService
	quotaService quota.Service
	systemUsers  SystemUsersFilterProvider
}

func ProvideService(
	sql db.DB,
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	quotaService quota.Service,
	systemUsersService SystemUsers,
) (StorageService, error) {
	settings, err := LoadStorageConfig(cfg, features)
	if err != nil {
		grafanaStorageLogger.Warn("error loading storage config", "error", err)
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
	if settings.AddDevEnv && setting.Env != setting.Prod {
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
		s, err := newStorage(root, filepath.Join(cfg.DataPath, "storage", "cache", root.Prefix))
		if err != nil {
			grafanaStorageLogger.Warn("error loading storage config", "error", err)
		}
		if s != nil {
			globalRoots = append(globalRoots, s)
		}
	}

	initializeOrgStorages := func(orgId int64) []storageRuntime {
		storages := make([]storageRuntime, 0)

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
				grafanaStorageLogger.Error("failed to create path filter for system user", "userID", user.UserID, "userLogin", user.Login, "err", err)
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
	s.quotaService = quotaService
	s.cfg = settings

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return nil, err
	}

	if err := quotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.Usage,
	}); err != nil {
		return nil, err
	}

	return s, nil
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(QuotaTargetSrv, QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.File)
	return limits, nil
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
	grafanaStorageLogger.Info("storage starting")
	return nil
}

func getOrgId(user *user.SignedInUser) int64 {
	if user == nil {
		return ac.GlobalOrgID
	}

	return user.OrgID
}

func (s *standardStorageService) List(ctx context.Context, user *user.SignedInUser, path string) (*StorageListFrame, error) {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(path))
	return s.tree.ListFolder(ctx, getOrgId(user), path, guardian.getPathFilter(ActionFilesRead))
}

func (s *standardStorageService) Read(ctx context.Context, user *user.SignedInUser, path string) (*filestorage.File, error) {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(path))
	if !guardian.canView(path) {
		return nil, ErrAccessDenied
	}
	return s.tree.GetFile(ctx, getOrgId(user), path)
}

func (s *standardStorageService) Usage(ctx context.Context, ScopeParameters *quota.ScopeParameters) (*quota.Map, error) {
	u := &quota.Map{}

	err := s.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		type result struct {
			Count int64
		}
		r := result{}
		rawSQL := fmt.Sprintf("SELECT COUNT(*) AS count FROM file WHERE path NOT LIKE '%s'", "%/")

		if _, err := sess.SQL(rawSQL).Get(&r); err != nil {
			return err
		}

		tag, err := quota.NewTag(QuotaTargetSrv, QuotaTarget, quota.GlobalScope)
		if err != nil {
			return err
		}
		u.Set(tag, r.Count)

		return nil
	})

	return u, err
}

type UploadRequest struct {
	Contents           []byte
	Path               string
	CacheControl       string
	ContentDisposition string
	Properties         map[string]string
	EntityType         EntityType

	OverwriteExistingFile bool
}

func (s *standardStorageService) Upload(ctx context.Context, user *user.SignedInUser, req *UploadRequest) error {
	if err := s.checkFileQuota(ctx, req.Path); err != nil {
		return err
	}

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
		grafanaStorageLogger.Warn("file upload validation failed", "path", req.Path, "reason", validationResult.reason)
		return ErrValidationFailed
	}

	upsertCommand, err := s.sanitizeUploadRequest(ctx, user, req, storagePath)
	if err != nil {
		grafanaStorageLogger.Error("failed while sanitizing the upload request", "path", req.Path, "error", err)
		return ErrUploadInternalError
	}

	grafanaStorageLogger.Info("uploading a file", "path", req.Path)

	if !req.OverwriteExistingFile {
		file, _, err := root.Store().Get(ctx, storagePath, &filestorage.GetFileOptions{WithContents: false})
		if err != nil {
			grafanaStorageLogger.Error("failed while checking file existence", "err", err, "path", req.Path)
			return ErrUploadInternalError
		}

		if file != nil {
			return ErrFileAlreadyExists
		}
	}

	if err := root.Store().Upsert(ctx, upsertCommand); err != nil {
		grafanaStorageLogger.Error("failed while uploading the file", "err", err, "path", req.Path)
		return ErrUploadInternalError
	}

	return nil
}

func (s *standardStorageService) checkFileQuota(ctx context.Context, path string) error {
	// assumes we are only uploading to the SQL database - TODO: refactor once we introduce object stores
	quotaReached, err := s.quotaService.CheckQuotaReached(ctx, QuotaTargetSrv, nil)
	if err != nil {
		grafanaStorageLogger.Error("failed while checking upload quota", "path", path, "error", err)
		return ErrUploadInternalError
	}

	if quotaReached {
		grafanaStorageLogger.Info("reached file quota", "path", path)
		return ErrQuotaReached
	}

	return nil
}

func (s *standardStorageService) DeleteFolder(ctx context.Context, user *user.SignedInUser, cmd *DeleteFolderCmd) error {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(cmd.Path))
	if !guardian.canDelete(cmd.Path) {
		return ErrAccessDenied
	}

	root, storagePath := s.tree.getRoot(getOrgId(user), cmd.Path)
	if root == nil {
		return ErrStorageNotFound
	}

	if root.Meta().ReadOnly {
		return ErrUnsupportedStorage
	}

	if err := s.validateFolderNameDoesNotConflictWithNestedStorages(root, storagePath, user.OrgID); err != nil {
		return err
	}

	if storagePath == "" {
		storagePath = filestorage.Delimiter
	}
	return root.Store().DeleteFolder(ctx, storagePath, &filestorage.DeleteFolderOptions{Force: cmd.Force, AccessFilter: guardian.getPathFilter(ActionFilesDelete)})
}

func (s *standardStorageService) CreateFolder(ctx context.Context, user *user.SignedInUser, cmd *CreateFolderCmd) error {
	if err := s.checkFileQuota(ctx, cmd.Path); err != nil {
		return err
	}

	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(cmd.Path))
	if !guardian.canWrite(cmd.Path) {
		return ErrAccessDenied
	}

	root, storagePath := s.tree.getRoot(getOrgId(user), cmd.Path)
	if root == nil {
		return ErrStorageNotFound
	}

	if root.Meta().ReadOnly {
		return ErrUnsupportedStorage
	}

	if err := s.validateFolderNameDoesNotConflictWithNestedStorages(root, storagePath, user.OrgID); err != nil {
		return err
	}

	err := root.Store().CreateFolder(ctx, storagePath)
	if err != nil {
		return err
	}
	return nil
}

func (s *standardStorageService) validateFolderNameDoesNotConflictWithNestedStorages(root storageRuntime, storagePath string, orgID int64) error {
	if !root.Meta().Config.UnderContentRoot {
		return nil
	}

	if storagePath == "" || storagePath == "/" {
		return ErrValidationFailed
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

func (s *standardStorageService) write(ctx context.Context, user *user.SignedInUser, req *WriteValueRequest) (*WriteValueResponse, error) {
	guardian := s.authService.newGuardian(ctx, user, getFirstSegment(req.Path))
	if !guardian.canWrite(req.Path) {
		return nil, ErrAccessDenied
	}

	root, storagePath := s.tree.getRoot(getOrgId(user), req.Path)
	if root == nil {
		return nil, ErrStorageNotFound
	}

	if root.Meta().ReadOnly {
		return nil, ErrUnsupportedStorage
	}

	// not svg!
	if req.EntityType != EntityTypeDashboard {
		return nil, ErrOnlyDashboardSaveSupported
	}

	// Save pretty JSON
	var prettyJSON bytes.Buffer
	if err := json.Indent(&prettyJSON, req.Body, "", "  "); err != nil {
		return nil, err
	}
	req.Body = prettyJSON.Bytes()

	// Modify the save request
	req.Path = storagePath
	req.User = user
	return root.Write(ctx, req)
}

type workflowInfo struct {
	Type        WriteValueWorkflow `json:"value"` // value matches selectable value
	Label       string             `json:"label"`
	Description string             `json:"description,omitempty"`
}
type optionInfo struct {
	Path      string         `json:"path,omitempty"`
	Workflows []workflowInfo `json:"workflows"`
}

func (s *standardStorageService) getWorkflowOptions(ctx context.Context, user *user.SignedInUser, path string) (optionInfo, error) {
	options := optionInfo{
		Path:      path,
		Workflows: make([]workflowInfo, 0),
	}

	root, _ := s.tree.getRoot(user.OrgID, path)
	if root == nil {
		return options, fmt.Errorf("can not read")
	}

	meta := root.Meta()
	if meta.Config.Type == rootStorageTypeGit && meta.Config.Git != nil {
		cfg := meta.Config.Git
		options.Workflows = append(options.Workflows, workflowInfo{
			Type:        WriteValueWorkflow_PR,
			Label:       "Create pull request",
			Description: "Create a new upstream pull request",
		})
		if !cfg.RequirePullRequest {
			options.Workflows = append(options.Workflows, workflowInfo{
				Type:        WriteValueWorkflow_Push,
				Label:       "Push to " + cfg.Branch,
				Description: "Push commit to upstrem repository",
			})
		}
	} else if meta.ReadOnly {
		// nothing?
	} else {
		options.Workflows = append(options.Workflows, workflowInfo{
			Type:        WriteValueWorkflow_Save,
			Label:       "Save",
			Description: "Save directly",
		})
	}

	return options, nil
}
