package export

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

func (r *exportJob) exportResourcesFromAPIServer(ctx context.Context) error {
	kinds := []schema.GroupVersionResource{{
		Group:    dashboard.GROUP,
		Resource: dashboard.DASHBOARD_RESOURCE,
		Version:  "v1alpha1",
	}}

	for _, kind := range kinds {
		r.progress.SetMessage(ctx, fmt.Sprintf("reading %s resource", kind.Resource))
		if err := r.client.ForEachResource(ctx, kind, func(_ dynamic.ResourceInterface, item *unstructured.Unstructured) error {
			r.progress.Record(ctx, r.exportResource(ctx, item))
			if err := r.progress.TooManyErrors(); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return fmt.Errorf("error exporting %s %w", kind.Resource, err)
		}
	}

	return nil
}

func (r *exportJob) exportResource(ctx context.Context, obj *unstructured.Unstructured) jobs.JobResourceResult {
	gvk := obj.GroupVersionKind()
	result := jobs.JobResourceResult{
		Name:     obj.GetName(),
		Resource: gvk.Kind,
		Group:    gvk.Group,
		Action:   repository.FileActionCreated,
	}

	if err := ctx.Err(); err != nil {
		result.Error = fmt.Errorf("context error: %w", err)
		return result
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		result.Error = fmt.Errorf("extract meta accessor: %w", err)
		return result
	}

	// Message from annotations
	commitMessage := meta.GetMessage()
	if commitMessage == "" {
		g := meta.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

	name := meta.GetName()
	manager, _ := meta.GetManagerProperties()
	if manager.Identity == r.target.Config().GetName() {
		result.Action = repository.FileActionIgnored
		return result
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Get the absolute path of the folder
	fid, ok := r.folderTree.DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		r.logger.Error("folder of item was not in tree of repository")
	}

	result.Path = fid.Path

	// Clear the metadata
	delete(obj.Object, "metadata")

	if r.keepIdentifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		result.Error = fmt.Errorf("failed to marshal dashboard: %w", err)
		return result
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}
	if r.path != "" {
		fileName = safepath.Join(r.path, fileName)
	}

	err = r.target.Write(ctx, fileName, r.ref, body, commitMessage)
	if err != nil {
		result.Error = fmt.Errorf("failed to write file: %w", err)
	}

	return result
}
