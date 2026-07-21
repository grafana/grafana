package export

import (
	"context"
	"errors"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// ExportFolders will load the full folder tree into memory and update the repositoryResources tree
func ExportFolders(ctx context.Context, repoName string, options provisioning.ExportJobOptions, folderClient dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	// Load and write all folders
	// FIXME: we load the entire tree in memory
	progress.SetMessage(ctx, "read folder tree from API server")

	tree := resources.NewEmptyFolderTree()
	if err := resources.ForEach(ctx, folderClient, func(item *unstructured.Unstructured) error {
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}
		meta, err := utils.MetaAccessor(item)
		if err != nil {
			return fmt.Errorf("extract meta accessor: %w", err)
		}

		_, managed := meta.GetManagerProperties()
		// Skip if already managed by any manager (repository, file provisioning, etc.).
		// Classic shim kinds are managed without an identity, so rely on the managed flag.
		// Hack: App-generated folders that do not set the managedBy property (e.g. the SLO app) are excluded the same way. Should set these properties in the
		// apps themselves
		if managed || isAppGeneratedResource(item.GetName()) {
			return nil
		}

		return tree.AddUnstructured(item)
	}); err != nil {
		return fmt.Errorf("load folder tree: %w", err)
	}

	progress.SetMessage(ctx, "write folders to repository")
	if err := writeFolderTree(ctx, options, repositoryResources, tree, progress); err != nil {
		return fmt.Errorf("write folders to repository: %w", err)
	}

	return nil
}

// writeFolderTree replicates every folder in tree to the repository, recording
// each folder as a job result. It is shared by the full-tree export and by the
// selective export, which only assembles the folders that the requested
// resources actually need.
func writeFolderTree(ctx context.Context, options provisioning.ExportJobOptions, repositoryResources resources.RepositoryResources, tree resources.FolderTree, progress jobs.JobProgressRecorder) error {
	if err := checkFolderPathCollisions(ctx, tree); err != nil {
		return err
	}

	return repositoryResources.EnsureFolderTreeExists(ctx, tree, resources.EnsureFolderTreeExistsOptions{
		Ref:                  options.Branch,
		Path:                 options.Path,
		GenerateNewFolderIDs: options.GenerateNewFolderIDs,
		OnFolder: func(folder resources.Folder, created bool, err error) error {
			resultBuilder := jobs.NewFolderResult(folder.Path).WithName(folder.ID).WithAction(repository.FileActionCreated)

			// A folder that failed to write must keep a non-ignored action: the
			// recorder discards errors on FileActionIgnored results, so labelling
			// a failure as ignored would let a broken export (e.g. an invalid
			// folder path) drop the error and report the job as a success.
			switch {
			case err != nil:
				resultBuilder.WithError(fmt.Errorf("creating folder %s at path %s: %w", folder.ID, folder.Path, err))
			case !created:
				resultBuilder.WithAction(repository.FileActionIgnored)
			}
			progress.Record(ctx, resultBuilder.Build())

			return progress.TooManyErrors()
		},
	})
}

// checkFolderPathCollisions fails the export when two distinct folders normalize
// to the same repository path. SanitizeSegment can map different titles under the
// same parent onto one segment (for example "» Reports" and "Reports", or "A&B"
// and "AB"). Writing both would let the second folder be treated as already
// present — its _folder.json skipped or overwriting the first — while dashboards
// still land under the shared path, so one folder's on-disk metadata would
// silently represent the wrong UID/title. Refuse loudly instead, naming both
// folders so the user can rename one.
func checkFolderPathCollisions(ctx context.Context, tree resources.FolderTree) error {
	seen := make(map[string]resources.Folder)
	return tree.Walk(ctx, func(_ context.Context, folder resources.Folder, _ string) error {
		if prev, dup := seen[folder.Path]; dup && prev.ID != folder.ID {
			return fmt.Errorf(
				"folders %q (%s) and %q (%s) both export to path %q; rename one so their normalized paths differ",
				prev.Title, prev.ID, folder.Title, folder.ID, folder.Path)
		}
		seen[folder.Path] = folder
		return nil
	})
}

// exportFolderAncestry writes only the folders needed to place the selectively
// exported resources, instead of dragging in the entire instance folder tree.
// For every folder UID in folderUIDs it walks up to the root via the folder
// API, collecting each ancestor so the full nested path can be reconstructed,
// then writes that limited tree. A folder that was not explicitly requested is
// generated here purely so its child resources resolve to a valid path.
func exportFolderAncestry(ctx context.Context, options provisioning.ExportJobOptions, folderClient dynamic.ResourceInterface, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, folderUIDs []string) error {
	if len(folderUIDs) == 0 {
		return nil
	}

	progress.SetMessage(ctx, "export folders for selected resources")

	tree := resources.NewEmptyFolderTree()
	// seen guards against re-fetching ancestors shared by multiple resources.
	seen := make(map[string]struct{})
	for _, uid := range folderUIDs {
		if err := collectFolderAncestry(ctx, uid, folderClient, tree, seen); err != nil {
			return err
		}
	}

	return writeFolderTree(ctx, options, repositoryResources, tree, progress)
}

// collectFolderAncestry adds the folder identified by folderUID and its
// ancestors to tree by walking the parent chain through the folder API. The
// chain must be present so the tree can derive each folder's path from the
// titles of its ancestors. Folders already in seen (and therefore already in
// the tree with their own ancestry) are skipped.
//
// The walk stops at the first folder already owned by a manager (repository,
// file provisioning, etc.): such a folder must not be re-written into this
// repository, since it may be owned elsewhere. This mirrors the full
// ExportFolders pass, which skips folders with a manager identity. Ancestors
// above a managed boundary are intentionally not collected — the path then
// roots at the highest unmanaged folder, exactly as the full export resolves it.
func collectFolderAncestry(ctx context.Context, folderUID string, folderClient dynamic.ResourceInterface, tree resources.FolderTree, seen map[string]struct{}) error {
	current := folderUID
	for current != "" {
		if _, ok := seen[current]; ok {
			return nil
		}
		if tree.Count() >= resources.MaxNumberOfFolders {
			return errors.New("too many folders")
		}

		obj, err := folderClient.Get(ctx, current, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("get folder %q: %w", current, err)
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("extract meta accessor for folder %q: %w", current, err)
		}
		seen[current] = struct{}{}

		if _, managed := meta.GetManagerProperties(); managed || isAppGeneratedResource(current) {
			return nil
		}

		if err := tree.AddUnstructured(obj); err != nil {
			return fmt.Errorf("add folder %q to tree: %w", current, err)
		}
		current = meta.GetFolder()
	}

	return nil
}
