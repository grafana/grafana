package migrate

import (
	"context"
	"fmt"
	"path"
	"strings"
	"time"

	"google.golang.org/grpc/metadata"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func (j *migrationJob) importFromRepo(ctx context.Context, dual dualwrite.Service) error {
	err := j.wipeUnifiedAndSetMigratedFlag(ctx, dual)
	if err != nil {
		return fmt.Errorf("unable to reset unified storage %w", err)
	}

	tree, err := j.target.ReadTree(ctx, "")
	if err != nil {
		return err
	}

	folders, err := j.createFolders(ctx, tree)
	if err != nil {
		return err
	}

	for _, item := range tree {
		if !item.Blob || resources.ShouldIgnorePath(item.Path) {
			continue
		}
		_ = j.writeResourceFromFile(ctx, item.Path, folders)
	}

	return nil
}

func (j *migrationJob) wipeUnifiedAndSetMigratedFlag(ctx context.Context, dual dualwrite.Service) error {
	kinds := []schema.GroupResource{{
		Group:    folders.GROUP,
		Resource: folders.RESOURCE,
	}, {
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
	}}

	for _, gr := range kinds {
		status, _ := dual.Status(ctx, gr)
		if status.ReadUnified {
			return fmt.Errorf("unexpected state - already using unified storage for: %s", gr)
		}
		if status.Migrating > 0 {
			if time.Since(time.UnixMilli(status.Migrating)) < time.Second*30 {
				return fmt.Errorf("another migration job is running for: %s", gr)
			}
		}
		settings := resource.BatchSettings{
			RebuildCollection: true, // wipes everything in the collection
			Collection: []*resource.ResourceKey{{
				Namespace: j.namespace,
				Group:     gr.Group,
				Resource:  gr.Resource,
			}},
		}
		ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
		stream, err := j.batch.BatchProcess(ctx)
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		stats, err := stream.CloseAndRecv()
		if err != nil {
			return fmt.Errorf("error clearing unified %s / %w", gr, err)
		}
		logger := logging.FromContext(ctx)
		logger.Error("cleared unified stoage", "stats", stats)

		status.Migrated = time.Now().UnixMilli() // but not really... since the sync is starting
		status.ReadUnified = true
		status.WriteLegacy = false // keep legacy "clean"
		_, err = dual.Update(ctx, status)
		if err != nil {
			return err
		}
	}

	return nil
}

func (j *migrationJob) createFolders(ctx context.Context, tree []repository.FileTreeEntry) (*resources.FolderTree, error) {
	folders := j.client.Resource(schema.GroupVersionResource{
		Group:    folders.GROUP,
		Version:  folders.VERSION,
		Resource: folders.RESOURCE,
	})

	repoName := j.target.Config().Name
	folderLookup := resources.NewEmptyFolderTree()
	parent := resources.RootFolder(j.target.Config())
	if parent != "" {
		folderLookup.Add(resources.Folder{
			ID: parent,
		}, "")
		obj := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"spec": map[string]any{
					"title": j.target.Config().Spec.Title,
				},
			},
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return nil, fmt.Errorf("create meta accessor for the object: %w", err)
		}

		obj.SetNamespace(j.namespace)
		obj.SetName(parent)
		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name: repoName,
		})
		if _, err := folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create root folder: %w", err)
		}
	}

	var err error
	for _, item := range tree {
		if item.Blob {
			continue
		}

		f := resources.ParseFolder(item.Path, repoName)
		if folderLookup.In(f.ID) {
			continue
		}

		parent := resources.RootFolder(j.target.Config())
		var traverse string
		for i, part := range strings.Split(f.Path, "/") {
			if i == 0 {
				traverse = part
			} else {
				traverse, err = safepath.Join(traverse, part)
				if err != nil {
					return nil, fmt.Errorf("unable to make path: %w", err)
				}
			}

			f := resources.ParseFolder(traverse, repoName)
			if folderLookup.In(f.ID) {
				parent = f.ID
				continue
			}
			folderLookup.Add(f, parent)

			obj := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"spec": map[string]any{
						"title": part,
					},
				},
			}

			meta, err := utils.MetaAccessor(obj)
			if err != nil {
				return nil, fmt.Errorf("create meta accessor for the object: %w", err)
			}

			obj.SetNamespace(j.namespace)
			obj.SetName(f.ID)
			meta.SetFolder(parent)
			meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
				Name:      repoName,
				Path:      item.Path,
				Hash:      "",  // FIXME: which hash?
				Timestamp: nil, // ???&info.Modified.Time,
			})

			if _, err := folders.Create(ctx, obj, metav1.CreateOptions{}); err != nil {
				return nil, fmt.Errorf("failed to create folder: %w", err)
			}

			// traversal
			parent = f.ID
		}
	}
	return folderLookup, err
}

// copied from sync
func (j *migrationJob) writeResourceFromFile(ctx context.Context, filepath string, folders *resources.FolderTree) jobs.JobResourceResult {
	result := jobs.JobResourceResult{
		Path:   filepath,
		Action: repository.FileActionCreated,
	}

	if resources.ShouldIgnorePath(filepath) {
		result.Action = repository.FileActionIgnored
		return result
	}

	// Read the referenced file
	fileInfo, err := j.target.Read(ctx, filepath, "")
	if err != nil {
		result.Error = fmt.Errorf("failed to read file: %w", err)
		return result
	}

	parsed, err := j.parser.Parse(ctx, fileInfo, false) // no validation (we are about to write anyway)
	if err != nil {
		result.Error = fmt.Errorf("failed to parse file: %w", err)
		return result
	}

	dir := path.Dir(filepath)
	if dir != "." {
		f := resources.ParseFolder(dir, j.target.Config().Name)
		if !folders.In(f.ID) {
			result.Error = fmt.Errorf("parent folder does not exist: %s", filepath)
			return result
		}
		parsed.Meta.SetFolder(f.ID)
	}

	parsed.Meta.SetUID("")             // clear identifiers
	parsed.Meta.SetResourceVersion("") // clear identifiers

	result.Name = parsed.Obj.GetName()
	result.Resource = parsed.GVR.Resource
	result.Group = parsed.GVK.Group

	// migrate is always create
	_, result.Error = parsed.Client.Create(ctx, parsed.Obj, metav1.CreateOptions{})
	return result
}
