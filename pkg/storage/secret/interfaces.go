package secret

import (
	"context"
	"github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

type KeeperMetadataStorage interface {
	Create(ctx context.Context, keeper *v0alpha1.Keeper) (*v0alpha1.Keeper, error)
	Read(ctx context.Context, namespace xkube.Namespace, name string) (*v0alpha1.Keeper, error)
	Update(ctx context.Context, newKeeper *v0alpha1.Keeper) (*v0alpha1.Keeper, error)
	Delete(ctx context.Context, namespace xkube.Namespace, name string) error
	List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*v0alpha1.KeeperList, error)
}
