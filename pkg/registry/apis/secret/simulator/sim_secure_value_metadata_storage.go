package simulator

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

// Simulation version of contracts.SecureValueStorage
type SimSecureValueMetadataStorage struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabaseServer
}

func NewSimSecureMetadataValueStorage(simNetwork *SimNetwork, simDatabase *SimDatabaseServer) *SimSecureValueMetadataStorage {
	return &SimSecureValueMetadataStorage{simNetwork: simNetwork, simDatabase: simDatabase}
}

func (storage *SimSecureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseCreateSecureValueMetadataQuery(%+v, %+v, %+v)", transactionIDFromContext(ctx), sv.Namespace, sv.Name),
		Execute: func() any {
			return storage.simDatabase.onQuery(simDatabaseCreateSecureValueMetadataQuery{ctx: ctx, sv: sv, transactionID: transactionIDFromContext(ctx)})
		}}).(simDatabaseCreateSecureValueMetadataResponse)
	return reply.sv, reply.err
}
func (storage *SimSecureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	panic("TODO: SimSecureValueMetadataStorage.Read")
}
func (storage *SimSecureValueMetadataStorage) Update(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	panic("TODO: SimSecureValueMetadataStorage.Update")
}
func (storage *SimSecureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO: SimSecureValueMetadataStorage.Delete")
}
func (storage *SimSecureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	panic("TODO: SimSecureValueMetadataStorage.List")
}

func (storage *SimSecureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseSetExternalIDQuery(%+v, %+v, %+v, %+v)", transactionIDFromContext(ctx), namespace, name, externalID),
		Execute: func() any {
			return storage.simDatabase.onQuery(simDatabaseSetExternalIDQuery{transactionID: transactionIDFromContext(ctx), namespace: namespace, name: name, externalID: externalID})
		}}).(simDatabaseSetExternalIDResponse)
	return reply.err
}

func (storage *SimSecureValueMetadataStorage) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseSetStatusSucceeded(%+v, %+v, %+v)", transactionIDFromContext(ctx), namespace, name),
		Execute: func() any {
			return storage.simDatabase.onQuery(simDatabaseSetStatusSucceededQuery{transactionID: transactionIDFromContext(ctx), namespace: namespace, name: name})
		}}).(simDatabaseSetStatusSucceededResponse)
	return reply.err
}
