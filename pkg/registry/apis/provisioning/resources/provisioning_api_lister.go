package resources

import (
	"context"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// DefaultListPageSize is how many items a whole-list read asks for per request. It is high because
// the route pages in memory: every page costs it a full read of what the repository manages, so a
// repository under this size stays at the one request the unpaged read cost.
const DefaultListPageSize = 1000

// ResourceListerFromProvisioningAPI reads the managed-resource list and a repository's counts from
// the provisioning API server, for a caller with no unified-storage connection of its own.
type ResourceListerFromProvisioningAPI struct {
	client   rest.Interface
	pageSize int64
}

// NewResourceListerFromProvisioningAPI returns a lister over the repository's resources and stats
// subresources, reading a whole list in pages of pageSize. A non-positive pageSize uses
// DefaultListPageSize.
//
// Authentication comes with the client: the operator derives it from the config its provisioning
// clientset already uses, so the same exchanged access token is sent here.
func NewResourceListerFromProvisioningAPI(client rest.Interface, pageSize int64) *ResourceListerFromProvisioningAPI {
	if pageSize <= 0 {
		pageSize = DefaultListPageSize
	}
	return &ResourceListerFromProvisioningAPI{client: client, pageSize: pageSize}
}

// List implements ResourceLister. A caller that set a limit drives the pages itself and gets the
// single page it asked for, token included; a caller that did not gets the whole list, read one
// page at a time.
func (l *ResourceListerFromProvisioningAPI) List(ctx context.Context, namespace, repository string, opts ListOptions) (*provisioning.ResourceList, error) {
	if repository == "" {
		return nil, apierrors.NewBadRequest("a repository name is required to list managed resources")
	}
	if opts.Limit > 0 {
		return l.page(ctx, namespace, repository, opts)
	}
	return l.wholeList(ctx, namespace, repository, opts.Continue)
}

// wholeList follows the continue token from after on until the route answers without one. A
// truncated list must never come back as a whole one: the sync diffs against it and deletes what it
// did not see, so anything short of the last page is an error.
func (l *ResourceListerFromProvisioningAPI) wholeList(ctx context.Context, namespace, repository, after string) (*provisioning.ResourceList, error) {
	list := &provisioning.ResourceList{}
	seen := sets.New[string]()
	if after != "" {
		seen.Insert(after)
	}

	for token := after; ; {
		page, err := l.page(ctx, namespace, repository, ListOptions{Limit: l.pageSize, Continue: token})
		if err != nil {
			return nil, err
		}
		if list.Kind == "" {
			list.TypeMeta = page.TypeMeta
		}
		list.Items = append(list.Items, page.Items...)

		token = page.Continue
		if token == "" {
			return list, nil
		}
		// A server that ignores the paging parameters answers every request with the same page, so
		// following its token reads the same items forever.
		if seen.Has(token) {
			return nil, fmt.Errorf("listing resources of %s/%s: the server repeated a continue token after %d items instead of advancing the list", namespace, repository, len(list.Items))
		}
		seen.Insert(token)
	}
}

// page asks for one page, carrying the paging parameters as query parameters.
func (l *ResourceListerFromProvisioningAPI) page(ctx context.Context, namespace, repository string, opts ListOptions) (*provisioning.ResourceList, error) {
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
