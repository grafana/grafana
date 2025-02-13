package export

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// ExportJob holds all context for a running job
type exportJob struct {
	logger    logging.Logger
	client    *resources.DynamicClient // Read from
	target    repository.Repository    // Write to
	legacy    legacy.LegacyMigrator
	namespace string

	progress *jobs.JobProgressRecorder

	userInfo   map[string]repository.CommitSignature
	folderTree *resources.FolderTree

	prefix         string // from options (now clean+safe)
	ref            string // from options (only git)
	keepIdentifier bool
	withHistory    bool
}

func newExportJob(ctx context.Context,
	target repository.Repository,
	options provisioning.ExportJobOptions,
	client *resources.DynamicClient,
	progress *jobs.JobProgressRecorder,
) *exportJob {
	prefix := options.Prefix
	if prefix != "" {
		prefix = safepath.Clean(prefix)
	}
	return &exportJob{
		namespace:      target.Config().Namespace,
		target:         target,
		client:         client,
		logger:         logging.FromContext(ctx),
		progress:       progress,
		prefix:         prefix,
		ref:            options.Branch,
		keepIdentifier: options.Identifier,
		withHistory:    options.History,
		folderTree:     resources.NewEmptyFolderTree(),
	}
}

func (r *exportJob) add(ctx context.Context, obj *unstructured.Unstructured) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	item, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	// Message from annotations
	commitMessage := item.GetMessage()
	if commitMessage == "" {
		g := item.GetGeneration()
		if g > 0 {
			commitMessage = fmt.Sprintf("Generation: %d", g)
		} else {
			commitMessage = "exported from grafana"
		}
	}

	name := item.GetName()
	repoName := item.GetRepositoryName()
	if repoName == r.target.Config().GetName() {
		r.logger.Info("skip dashboard since it is already in repository", "dashboard", name)
		return nil
	}

	title := item.FindTitle("")
	if title == "" {
		title = name
	}
	folder := item.GetFolder()

	// Add the author in context (if available)
	ctx = r.withAuthorSignature(ctx, item)

	// Get the absolute path of the folder
	fid, ok := r.folderTree.DirPath(folder, "")
	if !ok {
		fid = resources.Folder{
			Path: "__folder_not_found/" + slugify.Slugify(folder),
		}
		r.logger.Error("folder of item was not in tree of repository")
	}

	// Clear the metadata
	delete(obj.Object, "metadata")

	if r.keepIdentifier {
		item.SetName(name) // keep the identifier in the metadata
	}

	body, err := json.MarshalIndent(obj.Object, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal dashboard %s: %w", name, err)
	}

	fileName := slugify.Slugify(title) + ".json"
	if fid.Path != "" {
		fileName, err = safepath.Join(fid.Path, fileName)
		if err != nil {
			return fmt.Errorf("error adding file path %s: %w", title, err)
		}
	}
	if r.prefix != "" {
		fileName, err = safepath.Join(r.prefix, fileName)
		if err != nil {
			return fmt.Errorf("error adding path prefix %s: %w", r.prefix, err)
		}
	}

	// Write the file
	err = r.target.Write(ctx, fileName, r.ref, body, commitMessage)
	if err != nil {
		// summary.Error++
		r.logger.Error("failed to write a file in repository", "error", err)
		// if len(summary.Errors) < 20 {
		// 	summary.Errors = append(summary.Errors, fmt.Sprintf("error writing: %s", fileName))
		// }
	} else {
		// summary.Write++
	}

	return nil
}

func (r *exportJob) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if r.userInfo == nil {
		return ctx
	}
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := r.userInfo[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}
	return repository.WithAuthorSignature(ctx, sig)
}
