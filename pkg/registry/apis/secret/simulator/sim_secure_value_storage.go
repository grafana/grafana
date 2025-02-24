package simulator

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// Simulation version of contracts.SecureValueStorage
type SimSecureValueStorage struct {
	simNetwork *SimNetwork
}

func NewSimSecureValueStorage(simNetwork *SimNetwork) *SimSecureValueStorage {
	return &SimSecureValueStorage{simNetwork: simNetwork}
}

func (storage *SimSecureValueStorage) Create(ctx context.Context, tx contracts.TransactionManager, sv *secretv0alpha1.SecureValue, cb func(*secretv0alpha1.SecureValue, error)) {
	storage.simNetwork.Send(simDatabaseCreateSecureValueMetadataQuery{ctx: ctx, tx: tx, sv: sv, cb: cb})
}
func (storage *SimSecureValueStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	panic("TODO")
}
func (storage *SimSecureValueStorage) Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	panic("TODO")
}
func (storage *SimSecureValueStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO")
}
func (storage *SimSecureValueStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	panic("TODO")
}

func (storage *SimSecureValueStorage) SecretMetadataHasPendingStatus(ctx context.Context, tx contracts.TransactionManager, namespace xkube.Namespace, name string, cb func(bool, error)) {
	storage.simNetwork.Send(simDatabaseSecretMetadataHasPendingStatusQuery{ctx: ctx, tx: tx, namespace: namespace, name: name, cb: cb})
}
