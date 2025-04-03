package simulator

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// Implementation of contracts.KeeperMetadataStorage
type SimKeeperMetadataStorage struct{}

func NewSimKeeperMetadataStorage() *SimKeeperMetadataStorage {
	return &SimKeeperMetadataStorage{}
}

func (storage *SimKeeperMetadataStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Create")
}

func (storage *SimKeeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Read")
}

func (storage *SimKeeperMetadataStorage) Update(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Update")
}

func (storage *SimKeeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO: SimKeeperMetadataStorage.Delete")
}

func (storage *SimKeeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	panic("TODO: SimKeeperMetadataStorage.List")
}

func (storage *SimKeeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name string) (contracts.KeeperType, secretv0alpha1.KeeperConfig, error) {
	return contracts.SQLKeeperType, &secretv0alpha1.SQLKeeperConfig{}, nil
}
