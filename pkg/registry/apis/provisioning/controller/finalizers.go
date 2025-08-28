package controller

import (
	"context"
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

// RemoveOrphanResourcesFinalizer removes everything this repo created
const RemoveOrphanResourcesFinalizer = "remove-orphan-resources"

// ReleaseOrphanResourcesFinalizer removes the metadata for anything this repo created
const ReleaseOrphanResourcesFinalizer = "release-orphan-resources"

// CleanFinalizer calls the "OnDelete" function for resource
const CleanFinalizer = "cleanup"

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
		case CleanFinalizer:
			// NOTE: the controller loop will never get run unless a finalizer is set
			hooks, ok := repo.(repository.Hooks)
			if ok {
				if err := hooks.OnDelete(ctx); err != nil {
					logger.Warn("Error running deletion hooks", "err", err)
				}
			}

		case ReleaseOrphanResourcesFinalizer:
			err := f.processExistingItems(ctx, repo.Config(),
				func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
					_, err := client.Patch(ctx, item.Name, types.MergePatchType, []byte(`{
						"metadata": {
							"annotations": {
								"`+utils.AnnoKeyManagerKind+`": null,
								"`+utils.AnnoKeyManagerIdentity+`": null,
								"`+utils.AnnoKeySourcePath+`": null,
								"`+utils.AnnoKeySourceChecksum+`": null
							}
						}
					}`), v1.PatchOptions{})
					return err
				})
			if err != nil {
				return err
			}

		case RemoveOrphanResourcesFinalizer:
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
		res, _, err := clients.ForResource(schema.GroupVersionResource{
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
