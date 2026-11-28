package export

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// maxConcurrentFolderCounts limits the number of parallel calls to the folder
// counts API during the folder UID check.
const maxConcurrentFolderCounts = 8

type folderCountsGetter func(ctx context.Context, folderUID string) ([]folderv1.ResourceStats, error)

// exportedCounts holds, for each folder UID, how many resources of each kind
// the export writes directly into that folder.
type exportedCounts map[string]map[schema.GroupResource]int64

func (e exportedCounts) add(folderUID string, gr schema.GroupResource) {
	if folderUID == "" {
		return
	}
	if e[folderUID] == nil {
		e[folderUID] = make(map[schema.GroupResource]int64)
	}
	e[folderUID][gr]++
}

// folderUIDPlanner holds the input of the check that decides which folders
// keep their original UID.
type folderUIDPlanner struct {
	options   resources.FolderCheckOptions
	supported sets.Set[schema.GroupResource]
	exported  exportedCounts
	getCounts folderCountsGetter
}

// folderUIDCheckRequested - whether the migration requires the folder UID
// check. The migration then leaves GenerateNewFolderIDs off for the export, so
// that the check decides the UID of each folder.
func folderUIDCheckRequested(options provisioning.ExportJobOptions, folderCheck *resources.FolderCheckOptions) bool {
	return !options.GenerateNewFolderIDs && folderCheck != nil
}

// blockingFolder is a folder whose own contents the export does not migrate.
type blockingFolder struct {
	folder resources.Folder
	// reason lists the contents that are not migrated.
	reason string
	// topLevelFolder is the highest exported folder above the blocking folder,
	// or the blocking folder itself when it has no exported parent.
	topLevelFolder resources.Folder
}

// folderMigrationCheck is the result of checking every folder of an export tree.
type folderMigrationCheck struct {
	// foldersParentFirst lists every folder of the tree. Each parent comes
	// before its child folders.
	foldersParentFirst []resources.Folder
	// childFolderIDs lists the child folders of each folder.
	childFolderIDs map[string][]string
	// cleanlyMigratable are the folders whose whole subtree the export migrates.
	cleanlyMigratable map[string]struct{}
	// blockingFolders are the folders whose own contents the export does not
	// migrate. Their parent folders are not cleanly migratable either, but they
	// are not listed here.
	blockingFolders []blockingFolder
}

// folderUIDPlan is the decision for each folder of an export tree.
type folderUIDPlan struct {
	// newIDs are the folders that cannot keep their UID and get a new one.
	newIDs map[string]struct{}
	// skippedTopLevelFolders are the highest folders that are not migrated.
	// Their subfolders are not migrated either.
	skippedTopLevelFolders []resources.Folder
	// skipped are all the folders that are not migrated.
	skipped map[string]struct{}
	// blockingFolders explain why the skipped folders are not migrated.
	blockingFolders []blockingFolder
}

// plan decides which folders keep their UID. A folder that cannot keep its UID
// gets a new UID, or, when the migration does not request new folder UIDs, is
// not migrated together with its whole subtree.
func (c *folderUIDPlanner) plan(ctx context.Context, tree resources.FolderTree) folderUIDPlan {
	check := c.checkFolders(ctx, tree)

	p := folderUIDPlan{newIDs: make(map[string]struct{}), skipped: make(map[string]struct{})}
	if c.options.GenerateNewIDs {
		for _, folder := range check.foldersParentFirst {
			if _, ok := check.cleanlyMigratable[folder.ID]; !ok {
				p.newIDs[folder.ID] = struct{}{}
			}
		}
		return p
	}

	p.blockingFolders = check.blockingFolders
	// A folder is cleanly migratable only when all its child folders are, so
	// the parents of a blocking folder are not migratable either. Parents come
	// first, so the first folder of each chain that is not migratable is the
	// highest one.
	for _, folder := range check.foldersParentFirst {
		if _, ok := check.cleanlyMigratable[folder.ID]; ok {
			continue
		}
		if _, ok := p.skipped[folder.ID]; ok {
			continue
		}
		p.skippedTopLevelFolders = append(p.skippedTopLevelFolders, folder)
		subtreeIDs := []string{folder.ID}
		for len(subtreeIDs) > 0 {
			id := subtreeIDs[0]
			subtreeIDs = subtreeIDs[1:]
			p.skipped[id] = struct{}{}
			subtreeIDs = append(subtreeIDs, check.childFolderIDs[id]...)
		}
	}
	return p
}

func newFolderUIDPlanner(options resources.FolderCheckOptions, folderClient dynamic.ResourceInterface, supported sets.Set[schema.GroupResource], exported exportedCounts) *folderUIDPlanner {
	return &folderUIDPlanner{
		options:   options,
		supported: supported,
		exported:  exported,
		getCounts: func(ctx context.Context, folderUID string) ([]folderv1.ResourceStats, error) {
			return resources.GetFolderCounts(ctx, folderClient, folderUID)
		},
	}
}

// checkFolders walks tree once and checks every folder. A folder is cleanly
// migratable when the export moves everything directly in it and all its child
// folders are cleanly migratable. Only these folders can keep their UID without
// leaving resources behind in a folder that the repository then manages.
func (c *folderUIDPlanner) checkFolders(ctx context.Context, tree resources.FolderTree) folderMigrationCheck {
	check := folderMigrationCheck{
		childFolderIDs:    make(map[string][]string),
		cleanlyMigratable: make(map[string]struct{}),
	}
	parentFolderIDs := make(map[string]string)
	foldersByID := make(map[string]resources.Folder)
	_ = tree.Walk(ctx, func(_ context.Context, folder resources.Folder, parent string) error {
		check.foldersParentFirst = append(check.foldersParentFirst, folder)
		foldersByID[folder.ID] = folder
		if parent != "" {
			check.childFolderIDs[parent] = append(check.childFolderIDs[parent], folder.ID)
			parentFolderIDs[folder.ID] = parent
		}
		return nil
	})

	logger := logging.FromContext(ctx)
	var mu sync.Mutex
	countsByFolder := make(map[string][]folderv1.ResourceStats, len(check.foldersParentFirst))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(maxConcurrentFolderCounts)
	for _, folder := range check.foldersParentFirst {
		g.Go(func() error {
			folderCounts, err := c.getCounts(gctx, folder.ID)
			if err != nil {
				logger.Warn("unable to count folder contents", "folder", folder.ID, "error", err)
				return nil
			}
			mu.Lock()
			countsByFolder[folder.ID] = folderCounts
			mu.Unlock()
			return nil
		})
	}
	_ = g.Wait()

	topLevelFolder := func(folder resources.Folder) resources.Folder {
		for {
			parentID, ok := parentFolderIDs[folder.ID]
			if !ok {
				return folder
			}
			folder = foldersByID[parentID]
		}
	}

	// Go through the folders in reverse, so that each child folder is checked
	// before its parent.
	for i := len(check.foldersParentFirst) - 1; i >= 0; i-- {
		folder := check.foldersParentFirst[i]
		childIDs := check.childFolderIDs[folder.ID]

		folderCounts, counted := countsByFolder[folder.ID]
		reason := "its contents could not be counted"
		ok := false
		if counted {
			ok, reason = c.canCleanlyMigrateFolder(folderCounts, len(childIDs), c.exported[folder.ID])
		}
		if !ok {
			check.blockingFolders = append(check.blockingFolders, blockingFolder{
				folder:         folder,
				reason:         reason,
				topLevelFolder: topLevelFolder(folder),
			})
			continue
		}

		allChildrenMigratable := true
		for _, childID := range childIDs {
			if _, ok := check.cleanlyMigratable[childID]; !ok {
				allChildrenMigratable = false
				break
			}
		}
		if allChildrenMigratable {
			check.cleanlyMigratable[folder.ID] = struct{}{}
		}
	}
	return check
}

// canCleanlyMigrateFolder reports whether the export writes every resource that
// is directly in the folder. When it does not, reason lists what is left behind.
func (c *folderUIDPlanner) canCleanlyMigrateFolder(counts []folderv1.ResourceStats, exportedChildFolders int, exported map[schema.GroupResource]int64) (ok bool, reason string) {
	var leftBehind []string
	for _, row := range counts {
		if row.Count == 0 {
			continue
		}
		gr := schema.GroupResource{Group: row.Group, Resource: row.Resource}
		supported := c.supported.Has(gr)
		switch {
		case row.Group == resources.FolderCountsLegacyGroup:
			leftBehind = append(leftBehind, fmt.Sprintf("%d %s in legacy storage", row.Count, row.Resource))
		case gr == resources.FolderResource.GroupResource():
			if extra := row.Count - int64(exportedChildFolders); extra > 0 {
				leftBehind = append(leftBehind, fmt.Sprintf("%d folders that are not migrated", extra))
			}
		case supported:
			if extra := row.Count - exported[gr]; extra > 0 {
				leftBehind = append(leftBehind, fmt.Sprintf("%d %s that are not migrated", extra, row.Resource))
			}
		default:
			leftBehind = append(leftBehind, fmt.Sprintf("%d %s", row.Count, gr.String()))
		}
	}
	if len(leftBehind) == 0 {
		return true, ""
	}
	return false, strings.Join(leftBehind, ", ")
}

// blockingFolderError is the job warning for a folder that stops a migration
// of its top-level folder.
func blockingFolderError(blocking blockingFolder) error {
	if blocking.topLevelFolder.ID == blocking.folder.ID {
		return fmt.Errorf("folder %q and its subfolders are not migrated: it contains %s", blocking.folder.Title, blocking.reason)
	}
	return fmt.Errorf("folder %q contains %s, so its top-level folder %q and the folders in it are not migrated",
		blocking.folder.Title, blocking.reason, blocking.topLevelFolder.Title)
}

// countExportableResources counts, for each folder, the resources that the
// full export writes into it. The conditions must match exportItem.
func countExportableResources(ctx context.Context, clients resources.ResourceClients) (exportedCounts, sets.Set[schema.GroupResource], error) {
	exported := make(exportedCounts)
	supported := sets.New[schema.GroupResource]()
	for _, r := range clients.SupportedResources() {
		if r.GroupKind == resources.FolderKind.GroupKind() || !r.IsFolderScoped() {
			continue
		}
		client, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: r.Group, Kind: r.Kind})
		if err != nil {
			return nil, nil, fmt.Errorf("get client for %s: %w", r.Kind, err)
		}
		gr := gvr.GroupResource()
		supported.Insert(gr)
		if err := resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			if isAppGeneratedResource(item.GetName()) {
				return nil
			}
			meta, err := utils.MetaAccessor(item)
			if err != nil {
				return nil
			}
			if _, managed := meta.GetManagerProperties(); managed {
				return nil
			}
			exported.add(meta.GetFolder(), gr)
			return nil
		}); err != nil {
			return nil, nil, fmt.Errorf("count %s: %w", gvr.Resource, err)
		}
	}
	return exported, supported, nil
}
