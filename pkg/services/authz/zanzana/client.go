package zanzana

import (
	"context"
	"errors"
	"sync"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type PermissionChecker interface {
	CheckPermission(ctx context.Context, req *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error)
}

// PermissionCheckerProxy lets AccessControl depend on the narrow fallback
// checker without forcing every Wire target that constructs AccessControl to
// also construct the Zanzana server. The full server graph installs the real
// client before it starts serving requests.
type PermissionCheckerProxy struct {
	mu      sync.RWMutex
	checker PermissionChecker
}

func ProvidePermissionCheckerProxy() *PermissionCheckerProxy {
	return &PermissionCheckerProxy{}
}

func (p *PermissionCheckerProxy) Set(checker PermissionChecker) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.checker = checker
}

func (p *PermissionCheckerProxy) CheckPermission(ctx context.Context, req *authzextv1.CheckPermissionRequest) (*authzextv1.CheckPermissionResponse, error) {
	p.mu.RLock()
	checker := p.checker
	p.mu.RUnlock()
	if checker == nil {
		return nil, errors.New("zanzana fallback permission checker is not initialized")
	}
	return checker.CheckPermission(ctx, req)
}

// Client is a wrapper around [openfgav1.OpenFGAServiceClient]
type Client interface {
	authlib.AccessClient
	List(ctx context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error)
	Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error)
	Write(ctx context.Context, req *authzextv1.WriteRequest) error

	Mutate(ctx context.Context, req *authzextv1.MutateRequest) error
	Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error)
	PermissionChecker
}
