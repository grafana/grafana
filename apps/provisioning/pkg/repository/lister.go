package repository

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// StorageLister is an interface for listing repositories from storage.
// This is typically implemented by grafanarest.Storage.
type StorageLister interface {
	List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error)
}

// ClientLister is an interface for listing repositories using a typed client.
// This is typically implemented by the generated provisioning client.
type ClientLister interface {
	List(ctx context.Context, opts metav1.ListOptions) (*provisioning.RepositoryList, error)
}

// Lister provides methods for listing repositories.
type Lister struct {
	store  StorageLister
	client ClientLister
}

// NewLister creates a new Lister with the given storage.
func NewLister(store StorageLister) *Lister {
	return &Lister{store: store}
}

// NewListerFromClient creates a new Lister using a typed client.
func NewListerFromClient(client ClientLister) *Lister {
	return &Lister{client: client}
}

// List retrieves all repositories in the namespace from context.
// The namespace must be set in the context using request.WithNamespace.
func (l *Lister) List(ctx context.Context) ([]provisioning.Repository, error) {
	if l.client != nil {
		return l.listFromClient(ctx)
	}
	return l.listFromStorage(ctx)
}

func (l *Lister) listFromStorage(ctx context.Context) ([]provisioning.Repository, error) {
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

func (l *Lister) listFromClient(ctx context.Context) ([]provisioning.Repository, error) {
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
