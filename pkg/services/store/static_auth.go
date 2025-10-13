package store

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

type createPathFilterByAction func(ctx context.Context, user *user.SignedInUser, storageName string) map[string]filestorage.PathFilter

func newStaticStorageAuthService(createPathFilterByAction createPathFilterByAction) storageAuthService {
	return &staticStorageAuth{
		denyAllFileGuardian:      &denyAllFileGuardian{},
		createPathFilterByAction: createPathFilterByAction,
		log:                      log.New("staticStorageAuthService"),
	}
}

type staticStorageAuth struct {
	log                      log.Logger
	denyAllFileGuardian      fileGuardian
	createPathFilterByAction createPathFilterByAction
}

func (a *staticStorageAuth) newGuardian(ctx context.Context, user *user.SignedInUser, storageName string) fileGuardian {
	pathFilter := a.createPathFilterByAction(ctx, user, storageName)

	if pathFilter == nil {
		return a.denyAllFileGuardian
	}

	return &pathFilterFileGuardian{
		ctx:                ctx,
		user:               user,
		log:                a.log,
		prefix:             storageName,
		pathFilterByAction: pathFilter,
	}
}
