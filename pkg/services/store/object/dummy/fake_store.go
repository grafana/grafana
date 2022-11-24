package objectdummyserver

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/store/object"
)

// Make sure we implement both store + admin
var _ object.ObjectStoreServer = &fakeObjectStore{}
var _ object.ObjectStoreAdminServer = &fakeObjectStore{}

func ProvideFakeObjectServer() object.ObjectStoreServer {
	return &fakeObjectStore{}
}

type fakeObjectStore struct{}

func (i fakeObjectStore) AdminWrite(ctx context.Context, r *object.AdminWriteObjectRequest) (*object.WriteObjectResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) Write(ctx context.Context, r *object.WriteObjectRequest) (*object.WriteObjectResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) Read(ctx context.Context, r *object.ReadObjectRequest) (*object.ReadObjectResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) BatchRead(ctx context.Context, batchR *object.BatchReadObjectRequest) (*object.BatchReadObjectResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) Delete(ctx context.Context, r *object.DeleteObjectRequest) (*object.DeleteObjectResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) History(ctx context.Context, r *object.ObjectHistoryRequest) (*object.ObjectHistoryResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}

func (i fakeObjectStore) Search(ctx context.Context, r *object.ObjectSearchRequest) (*object.ObjectSearchResponse, error) {
	return nil, fmt.Errorf("unimplemented")
}
