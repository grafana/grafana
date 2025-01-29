package provisioning

import (
	"sort"
	"strings"

	"golang.org/x/net/context"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Remove everything this repo created
const REMOVE_ORPHAN_RESOURCE = "remove-orphan-resources"

// Remove the metadata for anything this repo created
const RELEASE_ORPHAN_RESOURCE = "release-orphan-resources"

// Calls the "OnDelete" function for resource
const CLEANUP_FINALIZER = "cleanup"

type finalizer struct {
	lister resources.ResourceLister
	client *resources.ClientFactory
}

func (f *finalizer) process(ctx context.Context,
	repo repository.Repository,
	finalizers []string,
) error {
	logger := logging.FromContext(ctx)

	for _, finalizer := range finalizers {
		switch finalizer {
		// Unless a finalizer is set, not callback will happen
		case CLEANUP_FINALIZER:
			hooks, ok := repo.(repository.RepositoryHooks)
			if ok {
				if err := hooks.OnDelete(ctx); err != nil {
					logger.Warn("Error running deletion hooks", "err", err)
				}
			}

		case RELEASE_ORPHAN_RESOURCE, REMOVE_ORPHAN_RESOURCE:
			err := f.processOrphans(ctx, repo.Config(),
				finalizer == REMOVE_ORPHAN_RESOURCE, // delete or update metadata
			)
			if err != nil {
				return err
			}
		default:
			logger.Warn("skipping unknown finalizer", "finalizer", finalizer)
		}
	}
	return nil
}

func (f *finalizer) processOrphans(ctx context.Context, repo *provisioning.Repository, delete bool) error {
	logger := logging.FromContext(ctx)
	client, _, err := f.client.New(repo.Namespace)
	if err != nil {
		return err
	}

	items, err := f.lister.List(ctx, repo.Namespace, repo.Name)
	if err != nil {
		logger.Warn("error listing resources", "error", err)
		return err
	}

	// Safe deletion order
	sortResourceListForDeletion(items)
	count := 0
	errors := 0

	for _, item := range items.Items {
		// HACK: we need to find a better way to know the API version
		var version string
		switch item.Group {
		case folders.GROUP:
			version = folders.VERSION
		case dashboards.GROUP:
			version = "v0alpha1" // the constant is internal
		default:
			version = "v0alpha1"
		}

		res := client.Resource(schema.GroupVersionResource{
			Group:    item.Group,
			Resource: item.Resource,
			Version:  version,
		})
		if delete {
			err = res.Delete(ctx, item.Name, v1.DeleteOptions{})
			if err != nil {
				logger.Warn("error removing item", "name", item.Name, "error", err)
				errors++
			} else {
				count++
			}
		} else {
			_, err = res.Patch(ctx, item.Name, types.JSONPatchType, []byte(`[
				{"op": "remove", "path": "/metadata/annotations/`+utils.AnnoKeyRepoName+`" },
				{"op": "remove", "path": "/metadata/annotations/`+utils.AnnoKeyRepoPath+`" },
				{"op": "remove", "path": "/metadata/annotations/`+utils.AnnoKeyRepoHash+`" }
			]`), v1.PatchOptions{})
			if err != nil {
				logger.Warn("error updating item metadata", "name", item.Name, "error", err)
				errors++
			} else {
				count++
			}
		}
	}
	logger.Info("processed orphan items", "items", count, "errors", errors)
	return nil
}

func sortResourceListForDeletion(list *provisioning.ResourceList) {
	// FIXME: this code should be simplified once unified storage folders support recursive deletion
	// Sort by the following logic:
	// - Put folders at the end so that we empty them first.
	// - Sort folders by depth so that we remove the deepest first
	sort.Slice(list.Items, func(i, j int) bool {
		switch {
		case list.Items[i].Group != folders.RESOURCE:
			return true
		case list.Items[j].Group != folders.RESOURCE:
			return false
		default:
			return len(strings.Split(list.Items[i].Path, "/")) > len(strings.Split(list.Items[j].Path, "/"))
		}
	})
}
