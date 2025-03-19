package contracts

import (
	"context"
	"errors"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

var (
	ErrKeeperNotFound = errors.New("keeper not found")
)

// KeeperMetadataStorage is the interface for wiring and dependency injection.
type KeeperMetadataStorage interface {
	Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
}
