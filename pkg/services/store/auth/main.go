package storeauth

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type Provider struct{}

var (
	denyAllService      = newDenyAllAuthService()
	storeAuthMainLogger = log.New("storeAuthMainLogger")
)

type StorageAuthService interface {
	NewGuardian(ctx context.Context, user *models.SignedInUser, prefix string) FilesGuardian
}

type FilesGuardian interface {
	CanView(path string) bool
	CanSave(path string) bool
	can(action string, path string) bool

	GetViewPathFilters() *filestorage.PathFilters
	GetSavePathFilters() *filestorage.PathFilters
}

// NewGuardian workaround to avoid issue with cyclical dependencies between `usagestats` and `accesscontrol`
var NewGuardian = func(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian {
	return denyAllService.NewGuardian(ctx, user, path)
}

func ProvideService(features featuremgmt.FeatureToggles) *Provider {
	if features.IsEnabled(featuremgmt.FlagAccesscontrol) {
		storeAuthMainLogger.Info("Initializing real storage auth service")
		storageAuthService := NewStorageAuthService()
		NewGuardian = func(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian {
			storeAuthMainLogger.Debug("Returning deny all file guardian")
			return storageAuthService.NewGuardian(ctx, user, path)
		}
	} else {
		storeAuthMainLogger.Info("Initializing dummy admin-only storage auth service")
		allowAllOnlyForAdminsAuthService := newAllowAllOnlyForAdminsAuthService()
		NewGuardian = func(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian {
			return allowAllOnlyForAdminsAuthService.NewGuardian(ctx, user, path)
		}
	}
	return &Provider{}
}
