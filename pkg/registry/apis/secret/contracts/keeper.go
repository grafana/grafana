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

// KeeperStorage is the interface for wiring and dependency injection.
type KeeperStorage interface {
	Create(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Read(ctx context.Context, nn xkube.NameNamespace) (*secretv0alpha1.Keeper, error)
	Update(ctx context.Context, sv *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error)
	Delete(ctx context.Context, nn xkube.NameNamespace) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error)
}
