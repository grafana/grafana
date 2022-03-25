package store

import (
	"context"
	"errors"
	"os"
	"path/filepath"

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
const RootUpload = "upload"

type StorageService interface {
	registry.BackgroundService

	// List folder contents
	List(ctx context.Context, user *models.SignedInUser, path string) (*data.Frame, error)

	// Read raw file contents out of the store
	Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error)
}

type standardStorageService struct {
	sql         *sqlstore.SQLStore
	tree        *nestedTree
	authService storageAuthService
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
	s := newStandardStorageService(roots)
	s.sql = sql

	if features.IsEnabled(featuremgmt.FlagAccesscontrol) && features.IsEnabled(featuremgmt.FlagStorageAccesscontrol) {
		grafanaStorageLogger.Info("Initializing accesscontrol storage auth service")
		s.authService = newAccessControlStorageAuthService()
	} else {
		storeAuthMainLogger.Info("Initializing static storage auth service")
		staticAuthRules := map[string][]string{
			RootPublicStatic: {ActionFilesRead},
		}
		if features.IsEnabled(featuremgmt.FlagStorageLocalUpload) {
			staticAuthRules[RootUpload] = []string{ActionFilesRead, ActionFilesWrite}
		}

		s.authService = newStaticStorageAuthService(staticAuthRules)
	}

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
	guardian := s.authService.newGuardian(ctx, user, s.tree.getRootPrefix(path))
	return s.tree.ListFolder(ctx, path, guardian.getViewPathFilter())
}

func (s *standardStorageService) Read(ctx context.Context, user *models.SignedInUser, path string) (*filestorage.File, error) {
	rootPrefix := s.tree.getRootPrefix(path)
	guardian := s.authService.newGuardian(ctx, user, rootPrefix)
	allowed := guardian.canView(path)
	if !allowed {
		grafanaStorageLogger.Warn("read access denied", "path", path, "rootPrefix", rootPrefix)
		return nil, errors.New("not found")
	}
	return s.tree.GetFile(ctx, path)
}
