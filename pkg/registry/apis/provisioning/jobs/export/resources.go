package export

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

func exportResourcesFromAPIServer(ctx context.Context, folders *resources.FolderManager, clients *resources.ResourceClients, progress jobs.JobProgressRecorder, options provisioning.ExportJobOptions, target repository.Writer) error {
	for _, kind := range resources.SupportedResources {
		// skip from folders as we do them first
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("reading %s resource", kind.Resource))
		if err := clients.ForEachResource(ctx, kind, func(_ dynamic.ResourceInterface, item *unstructured.Unstructured) error {
			result := jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: kind.Resource,
				Group:    kind.Group,
				Action:   repository.FileActionCreated,
			}

			fileName, err := exportResource(ctx, item, folders, options, target)
			if err != nil {
				result.Error = fmt.Errorf("export resource: %w", err)
			}
			result.Path = fileName
			progress.Record(ctx, result)

			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			return nil
		}); err != nil {
			return fmt.Errorf("error exporting %s %w", kind.Resource, err)
		}
	}

	return nil
}

func exportResource(ctx context.Context, obj *unstructured.Unstructured, folders *resources.FolderManager, options provisioning.ExportJobOptions, target repository.Writer) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", fmt.Errorf("context error: %w", err)
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return "", fmt.Errorf("extract meta accessor: %w", err)
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
	if manager.Identity == target.Config().GetName() {
		return "", nil
	}

	title := meta.FindTitle("")
	if title == "" {
		title = name
	}
	folder := meta.GetFolder()

	// Get the absolute path of the folder
	fid, ok := folders.Tree().DirPath(folder, "")
	if !ok {
		// FIXME: Shouldn't this fail instead?
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		// r.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	if options.Identifier {
		meta.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal dashboard: %w", err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName = safepath.Join(fid.Path, fileName)
	}
	if options.Path != "" {
		fileName = safepath.Join(options.Path, fileName)
	}

	err = target.Write(ctx, fileName, options.Branch, body, commitMessage)
	if err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return fileName, nil
}
