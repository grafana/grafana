package resources

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

//go:generate mockery --name RepositoryResourcesFactory --structname MockRepositoryResourcesFactory --inpackage --filename repository_resources_factory_mock.go --with-expecter
type RepositoryResourcesFactory interface {
	Client(ctx context.Context, repo repository.ReaderWriter) (RepositoryResources, error)
}

//go:generate mockery --name RepositoryResources --structname MockRepositoryResources --inpackage --filename repository_resources_mock.go --with-expecter
type RepositoryResources interface {
	EnsureFolderTreeExists(ctx context.Context, ref, path string, tree FolderTree, fn func(folder Folder, created bool, err error) error) error
	CreateResourceFileFromObject(ctx context.Context, obj *unstructured.Unstructured, options WriteOptions) (string, error)
}

type repositoryResourcesFactor struct {
	parsers ParserFactory
	clients ClientFactory
}
type repositoryResources struct {
	*FolderManager
	*ResourcesManager
}

func NewRepositoryResourcesFactory(parsers ParserFactory, clients ClientFactory) RepositoryResourcesFactory {
	return &repositoryResourcesFactor{parsers, clients}
}

func (r *repositoryResourcesFactor) Client(ctx context.Context, repo repository.ReaderWriter) (RepositoryResources, error) {
	clients, err := r.clients.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return nil, fmt.Errorf("create clients: %w", err)
	}

	folderClient, err := clients.Folder()
	if err != nil {
		return nil, fmt.Errorf("create folder client: %w", err)
	}
	parser, err := r.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("create parser: %w", err)
	}

	folders := NewFolderManager(repo, folderClient, NewEmptyFolderTree())
	resources := NewResourcesManager(repo, folders, parser, clients, map[string]repository.CommitSignature{})

	return &repositoryResources{folders, resources}, nil
}
