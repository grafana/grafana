package simulator

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// Implementation of contracts.KeeperMetadataStorage
type SimKeeperMetadataStorage struct{}

func NewSimKeeperMetadataStorage() *SimKeeperMetadataStorage {
	return &SimKeeperMetadataStorage{}
}

func (storage *SimKeeperMetadataStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper, actorUID string) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Create")
}

func (storage *SimKeeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Read")
}

func (storage *SimKeeperMetadataStorage) Update(ctx context.Context, keeper *secretv0alpha1.Keeper, actorUID string) (*secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.Update")
}

func (storage *SimKeeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO: SimKeeperMetadataStorage.Delete")
}

func (storage *SimKeeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.Keeper, error) {
	panic("TODO: SimKeeperMetadataStorage.List")
}

func (storage *SimKeeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name *string) (secretv0alpha1.KeeperConfig, error) {
	if name == nil {
		return nil, nil
	}

	panic(fmt.Sprintf("SimKeeperMetadataStorage.GetKeeperConfig: unhandled keeper namespace=%+v name=%+v", namespace, name))
}
