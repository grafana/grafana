package simulator

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// Simulation version of contracts.SecureValueStorage
type SimSecureValueMetadataStorage struct {
	simNetwork  *SimNetwork
	simDatabase *SimDatabaseServer
}

func NewSimSecureMetadataValueStorage(simNetwork *SimNetwork, simDatabase *SimDatabaseServer) *SimSecureValueMetadataStorage {
	return &SimSecureValueMetadataStorage{simNetwork: simNetwork, simDatabase: simDatabase}
}

func (storage *SimSecureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseCreateSecureValueMetadataQuery(%+v, %+v, %+v)", transactionIDFromContext(ctx), sv.Namespace, sv.Name),
		Execute: func() any {
			createdSv, err := storage.simDatabase.QueryCreateSecureValueMetadata(transactionIDFromContext(ctx), sv)
			return []any{createdSv, err}
		}}).([]any)
	return reply[0].(*secretv0alpha1.SecureValue), toError(reply[1])
}
func (storage *SimSecureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv0alpha1.SecureValue, error) {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseReadSecureValueMetadataQuery(%+v, %+v)", namespace, name),
		Execute: func() any {
			sv, err := storage.simDatabase.QueryReadSecureValueMetadata(namespace, name, opts)
			return []any{sv, err}
		}}).([]any)
	return reply[0].(*secretv0alpha1.SecureValue), toError(reply[1])
}
func (storage *SimSecureValueMetadataStorage) Update(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	panic("TODO: SimSecureValueMetadataStorage.Update")
}
func (storage *SimSecureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	storage.simDatabase.activityLog.Record("SimSecureValueMetadataStorage.Delete: will delete namespace=%+v name=%+v", namespace, name)
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseDeleteSecureValueMetadataQuery(%+v, %+v)", namespace, name),
		Execute: func() any {
			storage.simDatabase.activityLog.Record("SimSecureValueMetadataStorage.Delete: will call db.Delete namespace=%+v name=%+v", namespace, name)
			return storage.simDatabase.QueryDeleteSecureValueMetadata(namespace, name)
		}})
	storage.simDatabase.activityLog.Record("SimSecureValueMetadataStorage.Delete: reply=%+v", reply)
	return toError(reply)
}
func (storage *SimSecureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.SecureValue, error) {
	panic("TODO: SimSecureValueMetadataStorage.List")
}

func (storage *SimSecureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseSetExternalIDQuery(%+v, %+v, %+v, %+v)", transactionIDFromContext(ctx), namespace, name, externalID),
		Execute: func() any {
			return storage.simDatabase.QuerySetExternalID(transactionIDFromContext(ctx), namespace, name, externalID)
		}})
	return toError(reply)
}

func (storage *SimSecureValueMetadataStorage) SetStatus(ctx context.Context, namespace xkube.Namespace, name string, status secretv0alpha1.SecureValueStatus) error {
	reply := storage.simNetwork.Send(SendInput{
		Debug: fmt.Sprintf("DatabaseSetStatus(%+v, %+v, %+v)", transactionIDFromContext(ctx), namespace, name),
		Execute: func() any {
			return storage.simDatabase.QuerySetStatus(transactionIDFromContext(ctx), namespace, name, status)
		}})
	return toError(reply)
}

func (storage *SimSecureValueMetadataStorage) ReadForDecrypt(_ context.Context, _ xkube.Namespace, _ string) (*contracts.DecryptSecureValue, error) {
	panic("SimSecureValueMetadataStorage.ReadForDecrypt: unimplemneted")
}
