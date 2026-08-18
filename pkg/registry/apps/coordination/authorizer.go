package coordination

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// leaseStorageAuthorizer is the storage-level authorizer for the cluster-scoped
// Lease kind. It enforces the same fleet-identity rule for every storage
// operation — including watch — so a tenant token can neither read, mutate, nor
// observe fleet leases. It is fail-closed: any missing or non-fleet identity is
// denied, and the watch path returns RejectAllWatchFilter for unauthorized callers.
type leaseStorageAuthorizer struct {
	logger log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*leaseStorageAuthorizer)(nil)

func (a *leaseStorageAuthorizer) authorize(ctx context.Context) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return storewrapper.ErrUnauthorized
	}
	if !isFleetIdentity(requester) {
		return storewrapper.ErrUnauthorized
	}
	return nil
}

func (a *leaseStorageAuthorizer) BeforeCreate(ctx context.Context, _ runtime.Object) error {
	return a.authorize(ctx)
}

func (a *leaseStorageAuthorizer) BeforeUpdate(ctx context.Context, _, _ runtime.Object) error {
	return a.authorize(ctx)
}

func (a *leaseStorageAuthorizer) BeforeDelete(ctx context.Context, _ runtime.Object) error {
	return a.authorize(ctx)
}

func (a *leaseStorageAuthorizer) AfterGet(ctx context.Context, _ runtime.Object) error {
	return a.authorize(ctx)
}

func (a *leaseStorageAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	if err := a.authorize(ctx); err != nil {
		return nil, err
	}
	// Fleet leases carry no per-object tenant scoping: an authorized fleet identity
	// sees the whole global list unfiltered.
	return list, nil
}

func (a *leaseStorageAuthorizer) WatchFilter(ctx context.Context) (storewrapper.WatchEventFilter, error) {
	if err := a.authorize(ctx); err != nil {
		// Fail-closed: the wrapper refuses to start the watch on a nil filter.
		return storewrapper.RejectAllWatchFilter, err
	}
	// No per-event read restrictions once the caller is an authorized fleet identity.
	return storewrapper.PassThroughWatchFilter, nil
}
