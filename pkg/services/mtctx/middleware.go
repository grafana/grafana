package mtctx

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	v1 "k8s.io/api/core/v1"
)

type tenantInfoKey struct{}

var (
	ErrTenantInfoMissing = errors.New("missing tenant info")
)

type TenantInfo struct {
	StackID      int64
	Config       *v1.ConfigMap
	Err          error
	DBInitalized bool

	sessionDB *session.SessionDB
	mu        sync.Mutex // RWLock?
}

func ContextWithTenantInfo(ctx context.Context, data *TenantInfo) context.Context {
	return context.WithValue(ctx, tenantInfoKey{}, data)
}

func TenantInfoFromContext(ctx context.Context) (*TenantInfo, error) {
	c, ok := ctx.Value(tenantInfoKey{}).(*TenantInfo)
	if !ok || c == nil {
		return nil, ErrTenantInfoMissing
	}
	return c, nil
}

// Gets config.ini from kubernetes and returns a watcher to listen for changes
func (t *TenantInfo) GetSessionDB() *session.SessionDB {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.sessionDB != nil {
		return t.sessionDB
	}

	if t.Err != nil || t.Config == nil {
		return nil
	}

	t.sessionDB, t.Err = initializeDBConnection(t.Config)
	t.DBInitalized = t.sessionDB != nil
	return t.sessionDB
}
