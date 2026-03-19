package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sort"
	"strings"
	"sync/atomic"
	"time"

	"github.com/grafana/dskit/concurrency"
	"k8s.io/apimachinery/pkg/api/errors"
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
	metricutils "github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

type finalizer struct {
	lister        resources.ResourceLister
	clientFactory resources.ClientFactory
	metrics       *finalizerMetrics
	maxWorkers    int
}

func (f *finalizer) process(ctx context.Context,
	repo repository.Repository,
	finalizers []string,
) error {
	logger := logging.FromContext(ctx)
	logger.Info("process finalizers", "finalizers", finalizers)

	orderedFinalizers := [3]string{
		repository.CleanFinalizer,
		repository.ReleaseOrphanResourcesFinalizer,
		repository.RemoveOrphanResourcesFinalizer}

	for _, finalizer := range orderedFinalizers {
		if !slices.Contains(finalizers, finalizer) {
			continue
		}
		logger.Info("running finalizer", "finalizer", finalizer)
		var err error
		var count int
		start := time.Now()
		outcome := metricutils.SuccessOutcome

		switch finalizer {
		case repository.CleanFinalizer:
			// NOTE: the controller loop will never get run unless a finalizer is set
			logger.Info("running cleanup finalizer")
			hooks, ok := repo.(repository.Hooks)
			if ok {
				if err = hooks.OnDelete(ctx); err != nil {
					err = fmt.Errorf("execute deletion hooks: %w", err)
					outcome = metricutils.ErrorOutcome
				}
			}

		case repository.ReleaseOrphanResourcesFinalizer:
			logger.Info("releasing orphan resources")
			count, err = f.releaseExistingItems(ctx, repo.Config())
			if err != nil {
				err = fmt.Errorf("release resources: %w", err)
				outcome = metricutils.ErrorOutcome
			}

		case repository.RemoveOrphanResourcesFinalizer:
			logger.Info("removing orphan resources")
			count, err = f.deleteExistingItems(ctx, repo.Config())
			if err != nil {
				err = fmt.Errorf("remove resources: %w", err)
				outcome = metricutils.ErrorOutcome
			}

		default:
			logger.Error("skipping unknown finalizer", "finalizer", finalizer)
			continue
		}

		f.metrics.RecordFinalizer(finalizer, outcome, count, time.Since(start).Seconds())

		if err != nil {
			return err
		}
	}
	return nil
}

type itemProcessor func(ctx context.Context, item *provisioning.ResourceListItem) error

// newItemProcessor wraps a per-resource callback with client resolution and
// not-found handling.
func (f *finalizer) newItemProcessor(
	ctx context.Context,
	clients resources.ResourceClients,
	cb func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error,
) itemProcessor {
	logger := logging.FromContext(ctx)
	return func(jobCtx context.Context, item *provisioning.ResourceListItem) error {
		res, _, err := clients.ForResource(jobCtx, schema.GroupVersionResource{
			Group:    item.Group,
			Resource: item.Resource,
		})
		if err != nil {
			logger.Error("error getting client for resource", "resource", item.Resource, "error", err)
			return err
		}

		err = cb(res, item)
		if err != nil {
			if errors.IsNotFound(err) {
				logger.Info("resource not found, skipping", "name", item.Name, "group", item.Group, "resource", item.Resource)
				return nil
			}
			logger.Error("error processing item", "name", item.Name, "error", err)
			return fmt.Errorf("processing item: %w", err)
		}
		return nil
	}
}

// processFolderItems processes folder items sequentially to respect hierarchy.
func (f *finalizer) processFolderItems(ctx context.Context, items []*provisioning.ResourceListItem, process itemProcessor) (int, error) {
	var count int
	for _, item := range items {
		if err := process(ctx, item); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// processResourceItems processes non-folder items concurrently.
func (f *finalizer) processResourceItems(ctx context.Context, items []*provisioning.ResourceListItem, process itemProcessor) (int, error) {
	var processed int64
	err := concurrency.ForEachJob(ctx, len(items), f.maxWorkers, func(ctx context.Context, idx int) error {
		jobCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
		if err := process(jobCtx, items[idx]); err != nil {
			return err
		}
		atomic.AddInt64(&processed, 1)
		return nil
	})
	return int(processed), err
}

// splitItems separates a sorted list into folder items and non-folder items,
// preserving the order within each group.
func splitItems(items *provisioning.ResourceList) (folderItems, resourceItems []*provisioning.ResourceListItem) {
	for i := range items.Items {
		if items.Items[i].Group == folders.GroupVersion.Group {
			folderItems = append(folderItems, &items.Items[i])
		} else {
			resourceItems = append(resourceItems, &items.Items[i])
		}
	}
	return folderItems, resourceItems
}

// deleteExistingItems removes all resources managed by the repository.
// Non-folder resources are deleted concurrently first, then folders are
// deleted sequentially deepest-first so they are empty before removal.
func (f *finalizer) deleteExistingItems(
	ctx context.Context,
	repo *provisioning.Repository,
) (int, error) {
	logger := logging.FromContext(ctx)
	clients, err := f.clientFactory.Clients(ctx, repo.Namespace)
	if err != nil {
		return 0, err
	}

	items, err := f.lister.List(ctx, repo.Namespace, repo.Name)
	if err != nil {
		logger.Error("error listing resources", "error", err)
		return 0, err
	}

	sortResourceListForDeletion(items)
	folderItems, resourceItems := splitItems(items)
	process := f.newItemProcessor(ctx, clients, f.removeResources(ctx, logger))

	count, err := f.processResourceItems(ctx, resourceItems, process)
	if err != nil {
		return count, err
	}

	n, err := f.processFolderItems(ctx, folderItems, process)
	count += n
	if err != nil {
		return count, err
	}

	logger.Info("deleted items", "items", count)
	return count, nil
}

// releaseExistingItems releases all resources managed by the repository
// top-down by depth. Folders are released sequentially to respect hierarchy;
// non-folder resources between folder groups are released concurrently.
func (f *finalizer) releaseExistingItems(
	ctx context.Context,
	repo *provisioning.Repository,
) (int, error) {
	logger := logging.FromContext(ctx)
	clients, err := f.clientFactory.Clients(ctx, repo.Namespace)
	if err != nil {
		return 0, err
	}

	items, err := f.lister.List(ctx, repo.Namespace, repo.Name)
	if err != nil {
		logger.Error("error listing resources", "error", err)
		return 0, err
	}

	sortResourceListForRelease(items)
	folderItems, resourceItems := splitItems(items)
	process := f.newItemProcessor(ctx, clients, f.releaseResources(ctx, logger))

	n, err := f.processFolderItems(ctx, folderItems, process)
	count := n
	if err != nil {
		return count, err
	}

	n, err = f.processResourceItems(ctx, resourceItems, process)
	count += n
	if err != nil {
		return count, err
	}

	logger.Info("released items", "items", count)
	return count, nil
}

func (f *finalizer) releaseResources(
	ctx context.Context, logger logging.Logger,
) func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
	return func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
		logger.Info("release resource",
			"name", item.Name,
			"group", item.Group,
			"resource", item.Resource,
		)

		patchAnnotations, err := getPatchedAnnotations(item)
		if err != nil {
			return fmt.Errorf("get patched annotations: %w", err)
		}

		_, err = client.Patch(
			ctx, item.Name, types.JSONPatchType, patchAnnotations, v1.PatchOptions{},
		)
		if err != nil {
			return fmt.Errorf("patch resource to release ownership: %w", err)
		}
		return nil
	}
}

func (f *finalizer) removeResources(
	ctx context.Context, logger logging.Logger,
) func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
	return func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error {
		logger.Info("remove resource",
			"name", item.Name,
			"group", item.Group,
			"resource", item.Resource,
		)
		return client.Delete(ctx, item.Name, v1.DeleteOptions{})
	}
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

// sortResourceListForRelease orders items top-down by depth so that parent
// resources are unmanaged before their children. At equal depth, folders are
// ordered before other resources so a folder is released before anything it
// contains at the same level.
//
// Example result for a repo with nested folders and dashboards:
//
//	folderA/                          (depth 1, folder)
//	root-dashboard.json               (depth 1, resource)
//	folderA/subfolderB/               (depth 2, folder)
//	folderA/dashboard.json            (depth 2, resource)
//	folderA/subfolderB/dashboard.json (depth 3, resource)
func sortResourceListForRelease(list *provisioning.ResourceList) {
	sort.SliceStable(list.Items, func(i, j int) bool {
		depthI := len(strings.Split(list.Items[i].Path, "/"))
		depthJ := len(strings.Split(list.Items[j].Path, "/"))
		if depthI != depthJ {
			return depthI < depthJ
		}

		// at equal depth, folders before non-folders
		isFolderI := list.Items[i].Group == folders.GroupVersion.Group
		isFolderJ := list.Items[j].Group == folders.GroupVersion.Group
		if isFolderI != isFolderJ {
			return isFolderI
		}

		return false
	})
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
