package jobs

import (
	"bytes"
	"context"
	"fmt"
	"path"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type Syncer interface {
	Sync(ctx context.Context,
		repo repository.Repository,
		options provisioning.SyncJobOptions,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, *provisioning.SyncStatus, error)
}

type syncer struct {
	parser     *resources.Parser
	lister     resources.ResourceLister
	folders    dynamic.ResourceInterface
	dashboards dynamic.ResourceInterface
	repository repository.Repository
}

func NewSyncer(
	repo repository.Repository,
	lister resources.ResourceLister,
	parser *resources.Parser,
) (Syncer, error) {
	dynamicClient := parser.Client()
	if repo.Config().Namespace != dynamicClient.GetNamespace() {
		return nil, fmt.Errorf("namespace mismatch")
	}
	folders := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})
	dashboards := dynamicClient.Resource(schema.GroupVersionResource{
		Group:    dashboard.GROUP,
		Version:  "v1alpha1",
		Resource: dashboard.DASHBOARD_RESOURCE,
	})
	return &syncer{
		parser:     parser,
		lister:     lister,
		folders:    folders,
		dashboards: dashboards,
		repository: repo,
	}, nil
}

// Sync replicates all files in the repository.
func (r *syncer) Sync(ctx context.Context,
	repo repository.Repository,
	options provisioning.SyncJobOptions,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, *provisioning.SyncStatus, error) {
	cfg := r.repository.Config()
	if !cfg.Spec.Sync.Enabled {
		return &provisioning.JobStatus{
			State:   provisioning.JobStateError,
			Message: "sync is not enabled",
		}, nil, nil
	}

	// Ensure the configured folder exists and is managed by the repository
	rootFolder := resources.RootFolder(cfg)
	if rootFolder != "" {
		if err := r.ensureFolderExists(ctx, resources.Folder{
			ID:    rootFolder, // will not change if exists
			Title: cfg.Spec.Title,
		}, ""); err != nil {
			return nil, nil, fmt.Errorf("unable to create root folder: %w", err)
		}
	}

	syncStatus := &provisioning.SyncStatus{}
	logger := logging.FromContext(ctx)
	var err error
	var changes []repository.FileChange
	versionedRepo, isVersioned := r.repository.(repository.VersionedRepository)
	currentRef := ""

	if isVersioned && versionedRepo != nil {
		currentRef, err = versionedRepo.LatestRef(ctx)
		if err != nil {
			return nil, nil, fmt.Errorf("getting latest ref: %w", err)
		}
	}

	if isVersioned && cfg.Status.Sync.Hash != "" && !options.Complete {
		if currentRef == cfg.Status.Sync.Hash {
			message := "same commit as last sync"
			syncStatus.State = provisioning.JobStateSuccess
			syncStatus.Message = append(syncStatus.Message, message)
			return &provisioning.JobStatus{
				State:   provisioning.JobStateSuccess,
				Message: message,
			}, syncStatus, nil
		}

		logger.Info("get list of changes", "last_commit", cfg.Status.Sync.Hash, "latest", currentRef)
		changes, err = versionedRepo.CompareFiles(ctx, cfg.Status.Sync.Hash, currentRef)
		if err != nil {
			return nil, nil, fmt.Errorf("compare files: %w", err)
		}
	} else {
		target, err := r.lister.List(ctx, cfg.Namespace, cfg.Name)
		if err != nil {
			return nil, nil, fmt.Errorf("error listing current: %w", err)
		}
		source, err := repo.ReadTree(ctx, "")
		if err != nil {
			return nil, nil, fmt.Errorf("error reading tree: %w", err)
		}

		changes, err = repository.Changes(source, target)
		if err != nil {
			return nil, nil, fmt.Errorf("error calculating changes: %w", err)
		}
		for i := range changes {
			changes[i].Ref = "" // clear the refs so we do not try to write them
		}
	}

	if len(changes) == 0 {
		message := "no changes to sync"
		syncStatus.State = provisioning.JobStateSuccess
		syncStatus.Message = append(syncStatus.Message, message)
		return &provisioning.JobStatus{
			State:   provisioning.JobStateSuccess,
			Message: message,
		}, syncStatus, nil
	}

	// Now apply the changes
	status, err := r.replicateChanges(ctx, changes)
	if status == nil {
		status = &provisioning.JobStatus{}
	}
	if err != nil {
		status.State = provisioning.JobStateError
		status.Message = "Sync error: " + err.Error()
		syncStatus.State = status.State
		syncStatus.Message = append(syncStatus.Message, status.Message)
	} else if status.State == "" {
		status.State = provisioning.JobStateSuccess
	}
	return status, syncStatus, nil
}

func (r *syncer) replicateChanges(ctx context.Context, changes []repository.FileChange) (*provisioning.JobStatus, error) {
	// Create an empty tree to avoid loading all folders unnecessarily
	folderTree := resources.NewEmptyFolderTree()
	summary := provisioning.JobResourceSummary{}
	status := &provisioning.JobStatus{}

	// Create folder structure first
	for _, change := range changes {
		if resources.ShouldIgnorePath(change.Path) {
			summary.Noop++
			continue
		}
		if len(status.Errors) > 20 {
			status.Errors = append(status.Errors, "too many errors, stopping")
			status.State = provisioning.JobStateError
			return status, nil
		}

		if change.Action == repository.FileActionDeleted {
			if change.DB == nil {
				info, err := r.repository.Read(ctx, change.Path, change.Ref)
				if err != nil {
					status.Errors = append(status.Errors,
						fmt.Sprintf("error reading deleted file: %s", change.Path))
					continue
				}

				obj, gvk, _ := resources.DecodeYAMLObject(bytes.NewBuffer(info.Data))
				if obj == nil || obj.GetName() == "" {
					status.Errors = append(status.Errors,
						fmt.Sprintf("no object found in: %s", change.Path))
					continue
				}

				// Get the referenced
				change.DB = &provisioning.ResourceListItem{
					Group:    gvk.Group,
					Resource: getResourceFromGVK(gvk),
					Name:     obj.GetName(),
				}
			}

			client, err := r.client(change.DB)
			if err != nil {
				status.Errors = append(status.Errors,
					fmt.Sprintf("unsupported object: %s", change.Path))
				continue
			}
			err = client.Delete(ctx, change.DB.Name, metav1.DeleteOptions{})
			if err != nil {
				status.Errors = append(status.Errors,
					fmt.Sprintf("error deleting %s: %s // %s", change.DB.Resource, change.DB.Name, change.Path))
			} else {
				summary.Delete++
			}
			continue
		}

		// Make sure the parent folders exist
		parent, err := r.ensureFolderPathExists(ctx, change.Path, folderTree, r.repository.Config())
		if err != nil {
			return nil, err // fail when we can not make folders
		}

		// Replicate the file changes
		fileInfo, err := r.repository.Read(ctx, change.Path, change.Ref)
		if err != nil {
			status.Errors = append(status.Errors,
				fmt.Sprintf("Unable to read: %s", change.Path),
			)
			continue
		}

		parsed, err := r.parser.Parse(ctx, fileInfo, false)
		if err != nil {
			status.Errors = append(status.Errors,
				fmt.Sprintf("Unable to parse: %s // %s", change.Path, err.Error()),
			)
			continue
		}

		parsed.Meta.SetFolder(parent)

		switch change.Action {
		case repository.FileActionCreated:
			_, err = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
			if err != nil {
				status.Errors = append(status.Errors,
					fmt.Sprintf("error creating: %s from %s", parsed.Obj.GetName(), change.Path),
				)
			} else {
				summary.Create++
			}

		case repository.FileActionUpdated:
			_, err = parsed.Client.Update(ctx, parsed.Obj, metav1.UpdateOptions{})
			if err != nil {
				status.Errors = append(status.Errors,
					fmt.Sprintf("error updating: %s from %s", parsed.Obj.GetName(), change.Path),
				)
			} else {
				summary.Update++
			}
		default:
			return nil, fmt.Errorf("unexpected action: %s", change.Action)
		}
	}

	status.Summary = []provisioning.JobResourceSummary{summary}
	return status, nil
}

// ensureFolderPathExists creates the folder structure in the cluster.
func (r *syncer) ensureFolderPathExists(ctx context.Context, filePath string, folderTree *resources.FolderTree, cfg *provisioning.Repository) (parent string, err error) {
	f := resources.ParseFolder(path.Dir(filePath), cfg.Name)
	if folderTree.In(f.ID) {
		return f.ID, nil
	}

	parent = resources.RootFolder(cfg)
	traverse := ""

	for i, part := range strings.Split(f.Path, "/") {
		if i == 0 {
			traverse = part
		} else {
			traverse, err = safepath.Join(traverse, part)
			if err != nil {
				return "", fmt.Errorf("unable to make path: %w", err)
			}
		}

		f := resources.ParseFolder(traverse, cfg.GetName())
		if folderTree.In(f.ID) {
			parent = f.ID
			continue
		}

		err = r.ensureFolderExists(ctx, f, parent)
		if err != nil {
			return "", err
		}
		folderTree.Add(f, parent)
		parent = f.ID
	}
	return f.ID, err
}

// ensureFolderExists creates the folder if it doesn't exist.
// If the folder already exists:
// - it will error if the folder is not owned by this repository
func (r *syncer) ensureFolderExists(ctx context.Context, folder resources.Folder, parent string) error {
	cfg := r.repository.Config()
	obj, err := r.folders.Get(ctx, folder.ID, metav1.GetOptions{})
	if err == nil {
		current, ok := obj.GetAnnotations()[utils.AnnoKeyRepoName]
		if !ok {
			return fmt.Errorf("target folder is not managed by a repository")
		}
		if current != cfg.Name {
			return fmt.Errorf("target folder is managed by a different repository (%s)", current)
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
	meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
		Name:      cfg.GetName(),
		Path:      folder.Path,
		Hash:      "",  // FIXME: which hash?
		Timestamp: nil, // ???&info.Modified.Time,
	})

	if _, err := r.folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
		return fmt.Errorf("failed to create folder: %w", err)
	}

	return nil
}

func (r *syncer) client(obj *provisioning.ResourceListItem) (dynamic.ResourceInterface, error) {
	switch obj.Group {
	case dashboard.GROUP:
		switch obj.Resource {
		case dashboard.DASHBOARD_RESOURCE:
			return r.dashboards, nil
		}
	case folders.GROUP:
		switch obj.Resource {
		case folders.RESOURCE:
			return r.folders, nil
		}
	}
	return nil, fmt.Errorf("unsupported resource: %s/%s", obj.Group, obj.Resource)
}

func getResourceFromGVK(gvk *schema.GroupVersionKind) string {
	switch gvk.Group {
	case dashboard.GROUP:
		switch gvk.Kind {
		case "Dashboard":
			return dashboard.DASHBOARD_RESOURCE
		}
	case folders.GROUP:
		switch gvk.Kind {
		case "Folder":
			return folders.RESOURCE
		}
	}
	return ""
}
