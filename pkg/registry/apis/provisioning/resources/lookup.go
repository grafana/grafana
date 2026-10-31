package resources

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const MaxResourceLookupPaths = 50

type ResourcePathLookup interface {
	Lookup(ctx context.Context, namespace, repository string, paths []string) (*provisioning.ResourceList, error)
}

type resourcePathLookup struct {
	lister ResourceLister
	access authlib.AccessClient
}

func NewResourcePathLookup(lister ResourceLister, access authlib.AccessClient) ResourcePathLookup {
	return &resourcePathLookup{lister: lister, access: access}
}

// Lookup resolves exact paths in synced repository state, returning only resources
// readable by the caller. A trailing slash requests the folder itself, not its
// descendants; "/" requests the repository's root folder when one exists.
func (r *resourcePathLookup) Lookup(ctx context.Context, namespace, repository string, paths []string) (*provisioning.ResourceList, error) {
	caller, ok := authlib.AuthInfoFrom(ctx)
	if !ok || caller == nil || caller.GetIdentityType() == authlib.TypeAnonymous {
		return nil, apierrors.NewUnauthorized("authentication required")
	}
	if namespace == "" || !authlib.NamespaceMatches(caller.GetNamespace(), namespace) {
		return nil, apierrors.NewForbidden(provisioning.RepositoryResourceInfo.GroupResource(), repository, fmt.Errorf("namespace mismatch"))
	}
	if len(paths) == 0 || len(paths) > MaxResourceLookupPaths {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("paths must contain between 1 and %d entries", MaxResourceLookupPaths))
	}
	requested := sets.New[string]()
	for _, path := range paths {
		if path != "/" {
			if path == "" || safepath.IsAbs(path) {
				return nil, apierrors.NewBadRequest("paths must be relative to the configured repository root; use / for the root folder")
			}
			if err := safepath.IsSafe(path); err != nil {
				return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid resource path %q: %v", path, err))
			}
		}
		requested.Insert(path)
	}

	list, err := r.lister.List(ctx, namespace, repository)
	if err != nil {
		return nil, err
	}
	candidates := []provisioning.ResourceListItem{}
	seen := sets.New[string]()
	for _, item := range list.Items {
		if item.Group == FolderResource.Group && item.Resource == FolderResource.Resource {
			// Older folders omit the trailing slash; root folders have an empty path.
			item.Path = strings.TrimSuffix(item.Path, "/") + "/"
			if item.Path == "/" && item.Name != repository {
				continue
			}
		} else if strings.HasSuffix(item.Path, "/") {
			continue
		}
		if !requested.Has(item.Path) {
			continue
		}
		key := item.Group + "/" + item.Resource + "/" + item.Name
		if seen.Has(key) {
			continue
		}
		seen.Insert(key)
		candidates = append(candidates, item)
	}

	allowed, err := r.filterReadable(ctx, caller, namespace, candidates)
	if err != nil {
		return nil, err
	}
	return &provisioning.ResourceList{Items: allowed}, nil
}

func (r *resourcePathLookup) filterReadable(ctx context.Context, caller authlib.AuthInfo, namespace string, items []provisioning.ResourceListItem) ([]provisioning.ResourceListItem, error) {
	allowed := []provisioning.ResourceListItem{}
	// A path can match multiple objects, but BatchCheck accepts at most 50 checks.
	for batch := range slices.Chunk(items, MaxResourceLookupPaths) {
		checks := make([]authlib.BatchCheckItem, 0, len(batch))
		for i, item := range batch {
			checks = append(checks, authlib.BatchCheckItem{CorrelationID: strconv.Itoa(i), Verb: utils.VerbGet, Group: item.Group, Resource: item.Resource, Name: item.Name, Folder: item.Folder})
		}
		// Listing does not authorize individual resources; strictly check every match.
		rsp, err := r.access.BatchCheck(ctx, caller, authlib.BatchCheckRequest{Namespace: namespace, Checks: checks})
		if err != nil {
			return nil, err
		}
		for i, item := range batch {
			check, ok := rsp.Results[strconv.Itoa(i)]
			if !ok {
				return nil, fmt.Errorf("missing resource lookup authorization result")
			}
			if check.Error != nil {
				return nil, check.Error
			}
			if check.Allowed {
				allowed = append(allowed, provisioning.ResourceListItem{
					Path: item.Path, Group: item.Group, Resource: item.Resource, Name: item.Name,
				})
			}
		}
	}
	return allowed, nil
}
