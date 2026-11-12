package resources

import (
	"context"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// ResourceListerFromProvisioningAPI reads the managed-resource list and a repository's counts from
// the provisioning API server, for a caller with no unified-storage connection of its own.
type ResourceListerFromProvisioningAPI struct {
	client rest.Interface
}

// NewResourceListerFromProvisioningAPI returns a lister over the repository's resources and
// stats subresources.
//
// Authentication comes with the client: the operator derives it from the config its provisioning
// clientset already uses, so the same exchanged access token is sent here.
func NewResourceListerFromProvisioningAPI(client rest.Interface) *ResourceListerFromProvisioningAPI {
	return &ResourceListerFromProvisioningAPI{client: client}
}

// List implements ResourceLister, asking for one page and returning it with the continue token the
// route answered. Following that token across pages is left to the caller.
func (l *ResourceListerFromProvisioningAPI) List(ctx context.Context, namespace, repository string, opts ListOptions) (*provisioning.ResourceList, error) {
	if repository == "" {
		return nil, apierrors.NewBadRequest("a repository name is required to list managed resources")
	}

	req := l.client.Get().
		Namespace(namespace).
		Resource(provisioning.RepositoryResourceInfo.GetName()).
		Name(repository).
		SubResource("resources")
	if opts.Limit > 0 {
		req = req.Param("limit", strconv.FormatInt(opts.Limit, 10))
	}
	if opts.Continue != "" {
		req = req.Param("continue", opts.Continue)
	}

	list := &provisioning.ResourceList{}
	if err := req.Do(ctx).Into(list); err != nil {
		return nil, err
	}
	return list, nil
}

// RepositoryStats implements ResourceLister, reading the counts for one repository. The
// subresource answers for the repository named in the path, so there is no list of managers to
// pick an entry out of.
func (l *ResourceListerFromProvisioningAPI) RepositoryStats(ctx context.Context, namespace, repository string) ([]provisioning.ResourceCount, error) {
	if repository == "" {
		return nil, apierrors.NewBadRequest("a repository name is required to count managed resources")
	}

	counts := &provisioning.ResourceCountList{}
	if err := l.client.Get().
		Namespace(namespace).
		Resource(provisioning.RepositoryResourceInfo.GetName()).
		Name(repository).
		SubResource("stats").
		Do(ctx).
		Into(counts); err != nil {
		return nil, err
	}
	return counts.Items, nil
}

var _ ResourceLister = (*ResourceListerFromProvisioningAPI)(nil)
