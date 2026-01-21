package repository

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RepositoryLister is an interface for listing repositories.
type RepositoryLister interface {
	List(ctx context.Context) ([]provisioning.Repository, error)
}

// storageListerBackend is an interface for listing repositories from storage.
// This is typically implemented by grafanarest.Storage.
type storageListerBackend interface {
	List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

// clientListerBackend is an interface for listing repositories using a typed client.
// This is typically implemented by the generated provisioning client.
type clientListerBackend interface {
	List(ctx context.Context, opts metav1.ListOptions) (*provisioning.RepositoryList, error)
}

// StorageLister implements RepositoryLister using storage backend.
type StorageLister struct {
	store storageListerBackend
}

// NewStorageLister creates a new StorageLister with the given storage.
func NewStorageLister(store storageListerBackend) *StorageLister {
	return &StorageLister{store: store}
}

// List retrieves all repositories from storage.
// The namespace must be set in the context using request.WithNamespace.
func (l *StorageLister) List(ctx context.Context) ([]provisioning.Repository, error) {
	var allRepositories []provisioning.Repository
	continueToken := ""

	for {
		obj, err := l.store.List(ctx, &internalversion.ListOptions{
			Limit:    100,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		}

		repositoryList, ok := obj.(*provisioning.RepositoryList)
		if !ok {
			return nil, fmt.Errorf("expected repository list")
		}

		allRepositories = append(allRepositories, repositoryList.Items...)

		continueToken = repositoryList.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return allRepositories, nil
}

// ClientLister implements RepositoryLister using a typed client.
type ClientLister struct {
	client clientListerBackend
}

// NewClientLister creates a new ClientLister using a typed client.
func NewClientLister(client clientListerBackend) *ClientLister {
	return &ClientLister{client: client}
}

// List retrieves all repositories using the typed client.
// The namespace must be set in the context using request.WithNamespace.
func (l *ClientLister) List(ctx context.Context) ([]provisioning.Repository, error) {
	var allRepositories []provisioning.Repository
	continueToken := ""

	for {
		list, err := l.client.List(ctx, metav1.ListOptions{
			Limit:    100,
			Continue: continueToken,
		})
		if err != nil {
			return nil, err
		}

		allRepositories = append(allRepositories, list.Items...)

		continueToken = list.GetContinue()
		if continueToken == "" {
			break
		}
	}

	return allRepositories, nil
}
