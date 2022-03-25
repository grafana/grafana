package store

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

func newStaticStorageAuthService(allowedActionsByStorage map[string][]string) storageAuthService {
	denyAllGuardian := &denyAllFileGuardian{}
	pathFilterMapByStorage := make(map[string]map[string]filestorage.PathFilter)
	for storage, allowedActions := range allowedActionsByStorage {
		pathFilterMap := make(map[string]filestorage.PathFilter)
		for _, allowedAction := range allowedActions {
			pathFilterMap[allowedAction] = allowAllPathFilter
		}

		pathFilterMapByStorage[storage] = pathFilterMap
	}

	return &staticStorageAuth{
		denyAllFileGuardian:    denyAllGuardian,
		pathFilterMapByStorage: pathFilterMapByStorage,
		log:                    log.New("staticStorageAuthService"),
	}
}

type staticStorageAuth struct {
	log                    log.Logger
	denyAllFileGuardian    fileGuardian
	pathFilterMapByStorage map[string]map[string]filestorage.PathFilter
}

func (a *staticStorageAuth) newGuardian(ctx context.Context, user *models.SignedInUser, storagePrefix string) fileGuardian {
	storageName := strings.TrimPrefix(storagePrefix, filestorage.Delimiter)
	pathFilterByAction, ok := a.pathFilterMapByStorage[storageName]

	if !ok {
		return a.denyAllFileGuardian
	}

	return &pathFilterFileGuardian{
		ctx:                ctx,
		user:               user,
		log:                a.log,
		storageName:        storageName,
		pathFilterByAction: pathFilterByAction,
	}
}
