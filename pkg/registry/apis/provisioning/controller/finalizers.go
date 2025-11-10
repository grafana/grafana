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
			count, err = f.processExistingItems(ctx, repo.Config(), f.releaseResources(ctx, logger))
			if err != nil {
				err = fmt.Errorf("release resources: %w", err)
				outcome = metricutils.ErrorOutcome
			}

		case repository.RemoveOrphanResourcesFinalizer:
			logger.Info("removing orphan resources")
			count, err = f.processExistingItems(ctx, repo.Config(), f.removeResources(ctx, logger))
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

// internal iterator to walk the existing items
func (f *finalizer) processExistingItems(
	ctx context.Context,
	repo *provisioning.Repository,
	cb func(client dynamic.ResourceInterface, item *provisioning.ResourceListItem) error,
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

	// Safe deletion order
	sortResourceListForDeletion(items)

	var dashboards, folderItems []*provisioning.ResourceListItem
	for _, item := range items.Items {
		if item.Group == folders.GroupVersion.Group {
			folderItems = append(folderItems, &item)
		} else {
			dashboards = append(dashboards, &item)
		}
	}

	processItem := func(jobCtx context.Context, item *provisioning.ResourceListItem) error {
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

	processGroup := func(group []*provisioning.ResourceListItem) (int, error) {
		var processed int64
		err := concurrency.ForEachJob(ctx, len(group), f.maxWorkers, func(ctx context.Context, idx int) error {
			jobCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()
			item := group[idx]
			if err := processItem(jobCtx, item); err != nil {
				return err
			}
			atomic.AddInt64(&processed, 1)
			return nil
		})
		return int(processed), err
	}

	count := 0

	if len(dashboards) > 0 {
		processed, err := processGroup(dashboards)
		if err != nil {
			return processed, err
		}
		count += processed
	}

	if len(folderItems) > 0 {
		for _, item := range folderItems {
			if err := processItem(ctx, item); err != nil {
				return count, err
			}
			count++
		}
	}

	logger.Info("processed items", "items", count)
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
