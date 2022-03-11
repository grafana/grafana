package storeauth

import (
	"context"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
)

type denyAllAuthService struct {
}

type denyAllAuthGuardian struct {
}

func (d denyAllAuthGuardian) CanView(path string) bool {
	return false
}

func (d denyAllAuthGuardian) CanSave(path string) bool {
	return false
}

func (d denyAllAuthGuardian) GetViewPathFilters() *filestorage.PathFilters {
	return denyAllFilters
}

func (d denyAllAuthGuardian) GetSavePathFilters() *filestorage.PathFilters {
	return denyAllFilters
}

func (d denyAllAuthService) NewGuardian(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian {
	return &denyAllAuthGuardian{}
}

func newDenyAllAuthService() StorageAuthService {
	return &denyAllAuthService{}
}

type allowAllOnlyForAdminsAuthService struct {
}

type allowAllAuthGuardian struct {
}

func (a allowAllAuthGuardian) CanView(path string) bool {
	return true
}

func (a allowAllAuthGuardian) CanSave(path string) bool {
	return true

}

func (a allowAllAuthGuardian) GetViewPathFilters() *filestorage.PathFilters {
	return allowAllFilters
}

func (a allowAllAuthGuardian) GetSavePathFilters() *filestorage.PathFilters {
	return allowAllFilters
}

func (a allowAllOnlyForAdminsAuthService) NewGuardian(ctx context.Context, user *models.SignedInUser, path string) FilesGuardian {
	if user.OrgRole == models.ROLE_ADMIN {
		return &allowAllAuthGuardian{}
	}

	return &denyAllAuthGuardian{}
}

func newAllowAllOnlyForAdminsAuthService() StorageAuthService {
	return &allowAllOnlyForAdminsAuthService{}
}
