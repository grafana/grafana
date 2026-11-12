package resources

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// ResourceListerFromProvisioningAPI reads the managed-resource list from the provisioning API
// server, for a caller with no unified-storage connection of its own.
type ResourceListerFromProvisioningAPI struct {
	client rest.Interface
}

// NewResourceListerFromProvisioningAPI returns a lister over the repository resources subresource.
//
// Authentication comes with the client: the operator derives it from the config its provisioning
// clientset already uses, so the same exchanged access token is sent here.
func NewResourceListerFromProvisioningAPI(client rest.Interface) *ResourceListerFromProvisioningAPI {
	return &ResourceListerFromProvisioningAPI{client: client}
}

// List implements ResourceLister. The whole list comes back in one response; paging it needs the
// subresource to take the parameters first.
func (l *ResourceListerFromProvisioningAPI) List(ctx context.Context, namespace, repository string) (*provisioning.ResourceList, error) {
	if repository == "" {
		return nil, apierrors.NewBadRequest("a repository name is required to list managed resources")
	}

	list := &provisioning.ResourceList{}
	err := l.client.Get().
		Namespace(namespace).
		Resource(provisioning.RepositoryResourceInfo.GetName()).
		Name(repository).
		SubResource("resources").
		Do(ctx).
		Into(list)
	if err != nil {
		return nil, err
	}
	return list, nil
}

// Stats implements ResourceLister. It has no route to read yet: the counts come from a repository
// stats subresource that does not exist.
func (l *ResourceListerFromProvisioningAPI) Stats(context.Context, string, string) (*provisioning.ResourceStats, error) {
	return nil, fmt.Errorf("[provisioning] resource_lister %q cannot read stats yet", ListerAPIs)
}

var _ ResourceLister = (*ResourceListerFromProvisioningAPI)(nil)
