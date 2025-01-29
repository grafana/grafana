package jobs

import (
	"context"
	"errors"
	"fmt"
	"path"
	"sort"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardsv2alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v2alpha1"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type Syncer struct {
	client     *resources.DynamicClient
	parser     *resources.Parser
	lister     resources.ResourceLister
	folders    dynamic.ResourceInterface
	repository repository.Repository
}

func NewSyncer(
	repo repository.Repository,
	lister resources.ResourceLister,
	parser *resources.Parser,
) (*Syncer, error) {
	dynamicClient := parser.Client()
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})

	return &Syncer{
		parser:     parser,
		client:     dynamicClient,
		lister:     lister,
		folders:    folders,
		repository: repo,
	}, nil
}

// Sync replicates all files in the repository.
func (r *Syncer) Sync(ctx context.Context, complete bool) (string, error) {
	// FIXME: how to handle the scenario in which folder changes?
	cfg := r.repository.Config()
	lastCommit := cfg.Status.Sync.Hash
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)

	// Ensure the configured folder exists and it's managed by the repository
	if cfg.Status.Sync.Folder != "" {
		title := cfg.Spec.Title
		if title == "" {
			title = cfg.Status.Sync.Folder
		}

		folder := resources.Folder{
			Path:  "",
			ID:    cfg.Status.Sync.Folder,
			Title: title,
		}

		// If the folder already exists, the parent won't be changed
		if err := r.ensureFolderExists(ctx, folder, ""); err != nil {
			return "", fmt.Errorf("ensure repository folder exists: %w", err)
		}
	}

	logger := logging.FromContext(ctx)

	if !isVersioned {
		logger.Info("replicate tree unversioned repository")
		if err := r.replicateTree(ctx, ""); err != nil {
			return "", fmt.Errorf("replicate tree: %w", err)
		}
		return "", nil
	}

	latest, err := versionedRepo.LatestRef(ctx)
	if err != nil {
		return "", fmt.Errorf("latest ref: %w", err)
	}

	if lastCommit == "" || complete {
		if err := r.replicateTree(ctx, latest); err != nil {
			return latest, fmt.Errorf("replicate tree: %w", err)
		}
		logger.Info("initial replication for versioned repository", "latest", latest)

		return latest, nil
	}

	logger.Info("replicate incremental changes for versioned repository", "last_commit", lastCommit, "latest", latest)
	changes, err := versionedRepo.CompareFiles(ctx, lastCommit, latest)
	if err != nil {
		return latest, fmt.Errorf("compare files: %w", err)
	}

	if err := r.replicateChanges(ctx, changes); err != nil {
		return latest, fmt.Errorf("replicate changes: %w", err)
	}

	return latest, nil
}

func (r *Syncer) cleanUnnecessaryResources(ctx context.Context, tree []repository.FileTreeEntry, list *provisioning.ResourceList) error {
	paths := make(map[string]bool)
	// Add root path
	paths[""] = true
	for _, entry := range tree {
		paths[entry.Path] = true
	}

	sortResourceListForDeletion(list)

	logger := logging.FromContext(ctx)

	var count int
	for _, i := range list.Items {
		if _, ok := paths[i.Path]; ok {
			continue
		}

		if err := r.deleteListResource(ctx, i); err != nil {
			return fmt.Errorf("delete list resource: %w", err)
		}

		count++
		logger.Info("deleted resource not present in repository", "resource", i)
	}

	if count == 0 {
		logger.Info("resources are in sync with repository")
	} else {
		logger.Info("deleted resources not present in repository", "count", count)
	}

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

func (r *Syncer) deleteListResource(ctx context.Context, item provisioning.ResourceListItem) error {
	// HACK: we need to find a better way to know the API version
	var version string
	switch item.Resource {
	case folders.RESOURCE:
		version = folders.VERSION
	case dashboards.DASHBOARD_RESOURCE:
		version = dashboardsv2alpha1.VERSION
	default:
		return fmt.Errorf("unknown resource api version: %s", item.Resource)
	}

	client := r.client.Resource(schema.GroupVersionResource{
		Group:    item.Group,
		Version:  version,
		Resource: item.Resource,
	})

	if err := client.Delete(ctx, item.Name, metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("delete resource: %w", err)
	}

	return nil
}

// replicateTree replicates all files in the repository.
func (r *Syncer) replicateTree(ctx context.Context, ref string) error {
	// Load the tree of the repository
	fileTree, err := r.repository.ReadTree(ctx, ref)
	if err != nil {
		return fmt.Errorf("read tree: %w", err)
	}

	// Load the list of resources in the cluster
	list, err := r.lister.List(ctx, r.client.GetNamespace(), r.repository.Config().Name)
	if err != nil {
		return fmt.Errorf("list resources: %w", err)
	}

	// Remove resources not longer present in the repository
	if err := r.cleanUnnecessaryResources(ctx, fileTree, list); err != nil {
		return fmt.Errorf("clean up before replicating tree: %w", err)
	}

	// Create folders
	folderTree := resources.NewFolderTreeFromResourceList(list)
	for _, entry := range fileTree {
		parent := resources.ParentFolder(path.Dir(entry.Path), r.repository.Config())
		if err := r.ensureFolderPathExists(ctx, path.Dir(entry.Path), parent, folderTree); err != nil {
			return fmt.Errorf("ensure folder path exists: %w", err)
		}
	}

	// Create a list of hashes to identify changed files
	hashes := make(map[string]string)
	for _, item := range list.Items {
		hashes[item.Path] = item.Hash
	}

	// Create Dashboards
	for _, entry := range fileTree {
		logger := logging.FromContext(ctx).With("file", entry.Path)
		if hashes[entry.Path] == entry.Hash {
			logger.Debug("file is up to date")
			continue
		}

		if !entry.Blob {
			logger.Debug("ignoring non-blob entry")
			continue
		}

		if resources.ShouldIgnorePath(entry.Path) {
			logger.Debug("ignoring file")
			continue
		}

		info, err := r.repository.Read(ctx, entry.Path, ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		// The parse function will fill in the repository metadata, so copy it over here
		info.Hash = entry.Hash
		info.Modified = nil // modified?

		parsed, err := r.parseResource(ctx, info)
		if err != nil {
			return fmt.Errorf("parse resource: %w", err)
		}

		if err := r.replicateFile(ctx, parsed, folderTree); err != nil {
			if errors.Is(err, resources.ErrUnableToReadResourceBytes) {
				logger.Info("file does not contain a resource")
				continue
			}
			return fmt.Errorf("replicate file: %w", err)
		}
	}

	return nil
}

// replicateFile creates a new resource in the cluster.
// If the resource already exists, it will be updated.
func (r *Syncer) replicateFile(ctx context.Context, file *resources.ParsedResource, folderTree *resources.FolderTree) error {
	logger := logging.FromContext(ctx).With("file", file.Info.Path, "ref", file.Info.Ref)
	logger = logger.With("action", file.Action, "name", file.Obj.GetName(), "file_namespace", file.Obj.GetNamespace(), "namespace", r.client.GetNamespace())

	parent := resources.ParentFolder(file.Info.Path, r.repository.Config())
	logger = logger.With("folder", parent)
	if parent != "" {
		if !folderTree.In(parent) {
			return fmt.Errorf("failed to find parent in tree for %s in %s", file.Info.Path, parent)
		}
		file.Meta.SetFolder(parent)
	}

	if file.Action == provisioning.ResourceActionCreate {
		_, err := file.Client.Create(ctx, file.Obj, metav1.CreateOptions{})
		if err != nil {
			return fmt.Errorf("failed to create object: %w", err)
		}
	} else if file.Action == provisioning.ResourceActionUpdate {
		existingMeta, err := utils.MetaAccessor(file.Existing)
		if err != nil {
			return fmt.Errorf("failed to create meta accessor for the existing object: %w", err)
		}

		// Just in case no uid is present on the metadata for some reason.
		logger := logger.With("previous_uid", file.Meta.GetUID(), "previous_resource_version", existingMeta.GetResourceVersion())
		if uid, ok, _ := unstructured.NestedString(file.Existing.Object, "spec", "uid"); ok {
			logger.Debug("updating file's UID with spec.uid", "uid", uid)
			file.Meta.SetUID(types.UID(uid))
		}
		if uid := existingMeta.GetUID(); uid != "" {
			logger.Debug("updating file's UID with existing meta uid", "uid", uid)
			file.Meta.SetUID(uid)
		}
		if rev := existingMeta.GetResourceVersion(); rev != "" {
			logger.Debug("updating file's UID with existing resource version", "version", rev)
			file.Meta.SetResourceVersion(rev)
		}
		if gen := existingMeta.GetGeneration(); gen != 0 {
			logger.Debug("updating file's UID with existing generation + 1", "generation", gen, "new_generation", gen+1)
			file.Meta.SetGeneration(gen + 1)
		}

		_, err = file.Client.Update(ctx, file.Obj, metav1.UpdateOptions{})
		if err != nil {
			return fmt.Errorf("failed to update object: %w", err)
		}
	} else {
		logger.Error("bug in Grafana: the file's action is unhandled")
		return fmt.Errorf("bug in Grafana: got a file.Action of '%s', which is not defined to be handled", file.Action)
	}

	logger.Info("Replicated file")

	return nil
}

func (r *Syncer) replicateChanges(ctx context.Context, changes []repository.FileChange) error {
	// Create an empty tree to avoid loading all folders unnecessarily
	folderTree := resources.NewEmptyFolderTree()

	// Create folder structure first
	for _, change := range changes {
		if change.Action == repository.FileActionDeleted {
			// FIXME: this will leave empty folder behind until the next sync
			continue
		}

		parent := resources.ParentFolder(path.Dir(change.Path), r.repository.Config())
		if err := r.ensureFolderPathExists(ctx, path.Dir(change.Path), parent, folderTree); err != nil {
			return fmt.Errorf("ensure folder path exists: %w", err)
		}
	}

	// Replicate the file changes
	for _, change := range changes {
		if resources.ShouldIgnorePath(change.Path) {
			continue
		}

		fileInfo, err := r.repository.Read(ctx, change.Path, change.Ref)
		if err != nil {
			return fmt.Errorf("read file: %w", err)
		}

		parsed, err := r.parseResource(ctx, fileInfo)
		if err != nil {
			return fmt.Errorf("parse resource: %w", err)
		}

		switch change.Action {
		case repository.FileActionCreated, repository.FileActionUpdated:
			if err := r.replicateFile(ctx, parsed, folderTree); err != nil {
				return fmt.Errorf("replicate file: %w", err)
			}
		case repository.FileActionRenamed:
			// delete in old path
			oldPath, err := r.repository.Read(ctx, change.PreviousPath, change.Ref)
			if err != nil {
				return fmt.Errorf("read previous path: %w", err)
			}
			oldParsed, err := r.parseResource(ctx, oldPath)
			if err != nil {
				return fmt.Errorf("parse old resource: %w", err)
			}
			if err := r.deleteFile(ctx, oldParsed); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}

			if err := r.replicateFile(ctx, parsed, folderTree); err != nil {
				return fmt.Errorf("replicate file in new path: %w", err)
			}
		case repository.FileActionDeleted:
			if err := r.deleteFile(ctx, parsed); err != nil {
				return fmt.Errorf("delete file: %w", err)
			}
		}
	}

	return nil
}

func (r *Syncer) deleteFile(ctx context.Context, file *resources.ParsedResource) error {
	_, err := file.Client.Get(ctx, file.Obj.GetName(), metav1.GetOptions{})
	// FIXME: Remove the 'false &&' when .Get returns 404 on 404 instead of 500. Until then, this is a really ugly workaround.
	if false && err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if object already exists: %w", err)
	}

	if err != nil { // IsNotFound
		return fmt.Errorf("get object to delete: %w", err)
	}

	if err = file.Client.Delete(ctx, file.Obj.GetName(), metav1.DeleteOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

func (r *Syncer) parseResource(ctx context.Context, fileInfo *repository.FileInfo) (*resources.ParsedResource, error) {
	file, err := r.parser.Parse(ctx, fileInfo, true)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file %s: %w", fileInfo.Path, err)
	}

	if file.GVR == nil {
		return nil, errors.New("parsed file is missing GVR")
	}

	if file.Client == nil {
		return nil, errors.New("parsed file is missing client")
	}

	return file, nil
}

// ensureFolderPathExists creates the folder structure in the cluster.
func (r *Syncer) ensureFolderPathExists(ctx context.Context, dirPath, parent string, folderTree *resources.FolderTree) error {
	return safepath.Walk(ctx, dirPath, func(ctx context.Context, path string) error {
		fid := resources.ParseFolder(path, r.repository.Config().GetName())
		if folderTree.In(fid.ID) {
			// already visited
			parent = fid.ID
			return nil
		}

		if err := r.ensureFolderExists(ctx, fid, parent); err != nil {
			return fmt.Errorf("ensure folder exists: %w", err)
		}

		folderTree.Add(fid, parent)
		parent = fid.ID

		return nil
	})
}

// ensureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will update the repository info.
// - it will keep the parent folder already set
func (r *Syncer) ensureFolderExists(ctx context.Context, folder resources.Folder, parent string) error {
	cfg := r.repository.Config()
	repoInfo := &utils.ResourceRepositoryInfo{
		Name:      cfg.GetName(),
		Path:      folder.Path,
		Hash:      "",  // FIXME: which hash?
		Timestamp: nil, // ???&info.Modified.Time,
	}
	obj, err := r.folders.Get(ctx, folder.ID, metav1.GetOptions{})
	if err == nil {
		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("create meta accessor for the object: %w", err)
		}

		existingInfo, err := meta.GetRepositoryInfo()
		if err != nil {
			return fmt.Errorf("get repository info: %w", err)
		}

		// Skip update if already present with right values
		if existingInfo.Name == repoInfo.Name && existingInfo.Path == repoInfo.Path {
			return nil
		}

		meta.SetRepositoryInfo(repoInfo)

		// TODO: should we keep the parent?
		if _, err := r.folders.Update(ctx, obj, metav1.UpdateOptions{}); err != nil {
			return fmt.Errorf("failed to add repo info to configured folder: %w", err)
		}

		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("failed to check if folder exists: %w", err)
	}

	obj = &unstructured.Unstructured{
		Object: map[string]interface{}{
			"spec": map[string]any{
				"title": folder.Title,
			},
		},
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("create meta accessor for the object: %w", err)
	}

	obj.SetNamespace(cfg.GetNamespace())
	obj.SetName(folder.ID)
	if parent != "" {
		meta.SetFolder(parent)
	}
	meta.SetRepositoryInfo(repoInfo)

	if _, err := r.folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	return nil
}
