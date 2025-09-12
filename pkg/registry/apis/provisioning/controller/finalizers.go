package controller

import (
	"context"
	"encoding/json"
	"sort"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type finalizer struct {
	lister        resources.ResourceLister
	clientFactory resources.ClientFactory
}

func (f *finalizer) process(ctx context.Context,
	repo repository.Repository,
	finalizers []string,
) error {
	logger := logging.FromContext(ctx)

	for _, finalizer := range finalizers {
		switch finalizer {
		case repository.CleanFinalizer:
			// NOTE: the controller loop will never get run unless a finalizer is set
			hooks, ok := repo.(repository.Hooks)
			if ok {
				if err := hooks.OnDelete(ctx); err != nil {
					logger.Warn("Error running deletion hooks", "err", err)
				}
			}

		case repository.ReleaseOrphanResourcesFinalizer:
			err := f.processExistingItems(ctx, repo.Config(),
				func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
					patchAnnotations, err := getPatchedAnnotations(item)
					if err != nil {
						return err
					}

					_, err = client.Patch(
						ctx, item.Name, types.JSONPatchType, patchAnnotations, v1.PatchOptions{},
					)
					return err
				})
			if err != nil {
				return err
			}

		case repository.RemoveOrphanResourcesFinalizer:
			err := f.processExistingItems(ctx, repo.Config(),
				func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
					return client.Delete(ctx, item.Name, v1.DeleteOptions{})
				})
			if err != nil {
				return err
			}

		default:
			logger.Warn("skipping unknown finalizer", "finalizer", finalizer)
		}
	}
	return nil
}

// internal iterator to walk the existing items
func (f *finalizer) processExistingItems(
	ctx context.Context,
	repo *provisioning.Repository,
	cb func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error,
) error {
	logger := logging.FromContext(ctx)
	clients, err := f.clientFactory.Clients(ctx, repo.Namespace)
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
		res, _, err := clients.ForResource(ctx, schema.GroupVersionResource{
			Group:    item.Group,
			Resource: item.Resource,
		})
		if err != nil {
			return err
		}

		err = cb(res, &item)
		if err != nil {
			logger.Warn("error processing item", "name", item.Name, "error", err)
			errors++
		} else {
			count++
		}
	}
	logger.Info("processed orphan items", "items", count, "errors", errors)
	return nil
}

type jsonPatchOperation struct {
	Op   string `json:"op"`
	Path string `json:"path"`
}

func getPatchedAnnotations(item *provisioning.ResourceListItem) ([]byte, error) {
	annotations := []jsonPatchOperation{
		{Op: "remove", Path: "/metadata/annotations/" + escapePatchString(utils.AnnoKeyManagerKind)},
		{Op: "remove", Path: "/metadata/annotations/" + escapePatchString(utils.AnnoKeyManagerIdentity)},
	}

	if item.Path != "" {
		annotations = append(
			annotations,
			jsonPatchOperation{
				Op: "remove", Path: "/metadata/annotations/" + escapePatchString(utils.AnnoKeySourcePath),
			},
		)
	}
	if item.Hash != "" {
		annotations = append(
			annotations,
			jsonPatchOperation{
				Op: "remove", Path: "/metadata/annotations/" + escapePatchString(utils.AnnoKeySourceChecksum),
			},
		)
	}

	return json.Marshal(annotations)
}

func escapePatchString(s string) string {
	s = strings.ReplaceAll(s, "~", "~0")
	s = strings.ReplaceAll(s, "/", "~1")
	return s
}

func sortResourceListForDeletion(list *provisioning.ResourceList) {
	// FIXME: this code should be simplified once unified storage folders support recursive deletion
	// Sort by the following logic:
	// - Put folders at the end so that we empty them first.
	// - Sort folders by depth so that we remove the deepest first
	// - If the repo is created within a folder in grafana, make sure that folder is last.
	sort.Slice(list.Items, func(i, j int) bool {
		isFolderI := list.Items[i].Group == folders.GroupVersion.Group
		isFolderJ := list.Items[j].Group == folders.GroupVersion.Group

		// non-folders always go first in the order of deletion.
		if isFolderI != isFolderJ {
			return !isFolderI
		}

		// if both are not folders, keep order (doesn't matter)
		if !isFolderI && !isFolderJ {
			return false
		}

		hasFolderI := list.Items[i].Folder != ""
		hasFolderJ := list.Items[j].Folder != ""
		// if one folder is in the root (i.e. does not have a folder specified), put that last
		if hasFolderI != hasFolderJ {
			return hasFolderI
		}

		// if both are nested folder, sort by depth, with the deepest one being first
		depthI := len(strings.Split(list.Items[i].Path, "/"))
		depthJ := len(strings.Split(list.Items[j].Path, "/"))
		if depthI != depthJ {
			return depthI > depthJ
		}

		// otherwise, keep order (doesn't matter)
		return false
	})
}
