package connection

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// ConnectionLister is an interface for listing connections.
type ConnectionLister interface {
	List(ctx context.Context) ([]provisioning.Connection, error)
}

// storageListerBackend lists connections from storage. This is typically
// implemented by grafanarest.Storage.
type storageListerBackend interface {
	List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

// StorageLister implements ConnectionLister using a storage backend.
type StorageLister struct {
	store storageListerBackend
}

// NewStorageLister creates a new StorageLister with the given storage.
func NewStorageLister(store storageListerBackend) *StorageLister {
	return &StorageLister{store: store}
}

// List retrieves all connections from storage.
// The namespace must be set in the context using request.WithNamespace.
func (l *StorageLister) List(ctx context.Context) ([]provisioning.Connection, error) {
	var allConnections []provisioning.Connection
	continueToken := ""

	for {
		obj, err := l.store.List(ctx, &internalversion.ListOptions{
			Limit:    100,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		}

		connectionList, ok := obj.(*provisioning.ConnectionList)
		if !ok {
			return nil, fmt.Errorf("expected connection list")
		}

		allConnections = append(allConnections, connectionList.Items...)

		continueToken = connectionList.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return allConnections, nil
}
