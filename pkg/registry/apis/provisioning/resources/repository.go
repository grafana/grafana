package resources

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

//go:generate mockery --name RepositoryResourcesFactory --structname MockRepositoryResourcesFactory --inpackage --filename repository_resources_factory_mock.go --with-expecter
type RepositoryResourcesFactory interface {
	Client(ctx context.Context, repo repository.ReaderWriter) (RepositoryResources, error)
}

//go:generate mockery --name RepositoryResources --structname MockRepositoryResources --inpackage --filename repository_resources_mock.go --with-expecter
type RepositoryResources interface {
	// Folders
	SetTree(tree FolderTree)
	EnsureFolderPathExist(ctx context.Context, filePath string) (parent string, err error)
	EnsureFolderExists(ctx context.Context, folder Folder, parentID string) error
	EnsureFolderTreeExists(ctx context.Context, ref, path string, tree FolderTree, fn func(folder Folder, created bool, err error) error) error
	// File from Resource
	WriteResourceFileFromObject(ctx context.Context, obj *unstructured.Unstructured, options WriteOptions) (string, error)
	// Resource from file
	WriteResourceFromFile(ctx context.Context, path, ref string) (string, schema.GroupVersionKind, error)
	RemoveResourceFromFile(ctx context.Context, path, ref string) (string, schema.GroupVersionKind, error)
	FindResourcePath(ctx context.Context, name string, gvk schema.GroupVersionKind) (string, error)
	RenameResourceFile(ctx context.Context, path, previousRef, newPath, newRef string) (string, schema.GroupVersionKind, error)
	// Stats
	Stats(ctx context.Context) (*provisioning.ResourceStats, error)
	List(ctx context.Context) (*provisioning.ResourceList, error)
}

type repositoryResourcesFactory struct {
	parsers ParserFactory
	clients ClientFactory
	lister  ResourceLister
}
type repositoryResources struct {
	*FolderManager
	*ResourcesManager
	lister    ResourceLister
	namespace string
	repoName  string
}

func (r *repositoryResources) Stats(ctx context.Context) (*provisioning.ResourceStats, error) {
	return r.lister.Stats(ctx, r.namespace, r.repoName)
}

func (r *repositoryResources) List(ctx context.Context) (*provisioning.ResourceList, error) {
	return r.lister.List(ctx, r.namespace, r.repoName)
}

// FindResourcePath finds the repository file path for a resource by its name and GroupVersionKind
func (r *repositoryResources) FindResourcePath(ctx context.Context, name string, gvk schema.GroupVersionKind) (string, error) {
	// Query managed objects to find the file path for this resource
	listerFromSearch, ok := r.lister.(*ResourceListerFromSearch)
	if !ok {
		return "", fmt.Errorf("lister does not support managed object queries")
	}

	// Convert GroupVersionKind to GroupVersionResource
	gvr := schema.GroupVersionResource{
		Group:    gvk.Group,
		Version:  gvk.Version,
		Resource: inferResourceNameFromKind(gvk.Kind),
	}

	objects, err := listerFromSearch.managed.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
		Namespace: r.namespace,
		Kind:      string(utils.ManagerKindRepo),
		Id:        r.repoName,
	})
	if err != nil {
		return "", fmt.Errorf("list managed objects for %s/%s/%s: %w", gvr.Group, gvr.Resource, name, err)
	}

	if objects.Error != nil {
		return "", fmt.Errorf("error listing managed objects: %s", objects.Error.Message)
	}

	// Filter results by group, resource, and name
	for _, item := range objects.Items {
		if item.Object != nil &&
			item.Object.Group == gvr.Group &&
			item.Object.Resource == gvr.Resource &&
			item.Object.Name == name &&
			item.Path != "" {
			return item.Path, nil
		}
	}

	return "", fmt.Errorf("resource not found in repository: %s/%s/%s", gvr.Group, gvr.Resource, name)
}

// inferResourceNameFromKind converts Kind to resource name (e.g., "Dashboard" -> "dashboards")
func inferResourceNameFromKind(kind string) string {
	switch kind {
	case "Dashboard":
		return "dashboards"
	case "Folder":
		return "folders"
	case "User":
		return "users"
	default:
		// Default conversion: lowercase + 's'
		return strings.ToLower(kind) + "s"
	}
}

func NewRepositoryResourcesFactory(parsers ParserFactory, clients ClientFactory, lister ResourceLister) RepositoryResourcesFactory {
	return &repositoryResourcesFactory{parsers, clients, lister}
}

func (r *repositoryResourcesFactory) Client(ctx context.Context, repo repository.ReaderWriter) (RepositoryResources, error) {
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
	resources := NewResourcesManager(repo, folders, parser, clients)

	return &repositoryResources{
		FolderManager:    folders,
		ResourcesManager: resources,
		lister:           r.lister,
		namespace:        repo.Config().Namespace,
		repoName:         repo.Config().Name,
	}, nil
}
