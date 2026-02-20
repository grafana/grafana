package zanzana

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type StoreInfo struct {
	ID      string
	Name    string
	ModelID string
}

type Server interface {
	authzv1.AuthzServiceServer
	authzextv1.AuthzExtentionServiceServer
	Close()
}

type MTReconciler interface {
	Run(ctx context.Context) error
	// EnsureNamespace checks if namespace is not exists, and if not, it reconciles it.
	EnsureNamespace(ctx context.Context, namespace string) error
}

type ServerInternal interface {
	Server
	RunReconciler(ctx context.Context) error
	GetStore(ctx context.Context, namespace string) (*StoreInfo, error)
	GetOrCreateStore(ctx context.Context, namespace string) (*StoreInfo, error)
	ListAllStores(ctx context.Context) ([]StoreInfo, error)
	WriteTuples(ctx context.Context, store *StoreInfo, writeTuples []*openfgav1.TupleKey, deleteTuples []*openfgav1.TupleKeyWithoutCondition) error
	GetOpenFGAServer() openfgav1.OpenFGAServiceServer
}
