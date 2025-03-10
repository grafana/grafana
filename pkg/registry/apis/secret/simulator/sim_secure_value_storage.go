package simulator

import (
	"context"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
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

func (storage *SimSecureValueStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	reply := storage.simNetwork.Send(ctx, simDatabaseCreateSecureValueMetadataQuery{ctx: ctx, sv: sv}).(simDatabaseCreateSecureValueMetadataResponse)
	return reply.sv, reply.err
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

func (storage *SimSecureValueStorage) SecretMetadataHasPendingStatus(ctx context.Context, namespace xkube.Namespace, name string) (bool, error) {
	reply := storage.simNetwork.Send(ctx, simDatabaseSecretMetadataHasPendingStatusQuery{ctx: ctx, namespace: namespace, name: name}).(simDatabaseSecretMetadataHasPendingStatusResponse)
	return reply.isPending, reply.err
}

func (storage *SimSecureValueStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID types.ExternalID) error {
	panic("TODO")
}

func (storage *SimSecureValueStorage) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO")
}
