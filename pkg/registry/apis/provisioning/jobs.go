package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type JobQueueGetter interface {
	GetJobQueue() jobs.Queue
}

type jobsConnector struct {
	repoGetter            RepoGetter
	statusPatcherProvider StatusPatcherProvider
	jobs                  JobQueueGetter
	historic              jobs.HistoryReader
	access                auth.AccessChecker
	resourcesFactory      resources.RepositoryResourcesFactory
}

func NewJobsConnector(
	repoGetter RepoGetter,
	statusPatcherProvider StatusPatcherProvider,
	jobs JobQueueGetter,
	historic jobs.HistoryReader,
	access auth.AccessChecker,
	resourcesFactory resources.RepositoryResourcesFactory,
) *jobsConnector {
	return &jobsConnector{
		repoGetter:            repoGetter,
		statusPatcherProvider: statusPatcherProvider,
		jobs:                  jobs,
		historic:              historic,
		access:                access,
		resourcesFactory:      resourcesFactory,
	}
}

func (*jobsConnector) New() runtime.Object {
	return &provisioning.Repository{}
}

func (*jobsConnector) Destroy() {}

func (*jobsConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *jobsConnector) ProducesObject(verb string) any {
	return &provisioning.Job{}
}

func (*jobsConnector) ConnectMethods() []string {
	return []string{http.MethodPost, http.MethodGet}
}

func (*jobsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // path -> uid
}

func (c *jobsConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	return WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		prefix := fmt.Sprintf("/%s/jobs/", name)
		idx := strings.Index(r.URL.Path, prefix)
		if r.Method == http.MethodGet {
			// GET operations: allow even for unhealthy repositories
			repo, err := c.repoGetter.GetRepository(ctx, name)
			if err != nil {
				responder.Error(err)
				return
			}
			cfg := repo.Config()
			if idx > 0 {
				jobUID := r.URL.Path[idx+len(prefix):]
				if !ValidUUID(jobUID) {
					responder.Error(apierrors.NewBadRequest(fmt.Sprintf("invalid job uid: %s", jobUID)))
					return
				}
				job, err := c.historic.GetJob(ctx, cfg.Namespace, name, jobUID)
				if err != nil {
					responder.Error(err)
					return
				}
				responder.Object(http.StatusOK, job)
				return
			}
			recent, err := c.historic.RecentJobs(ctx, cfg.Namespace, name)
			if err != nil {
				responder.Error(err)
				return
			}
			responder.Object(http.StatusOK, recent)
			return
		}

		// POST operations: require healthy repository
		repo, err := c.repoGetter.GetHealthyRepository(ctx, name)
		if err != nil {
			responder.Error(err)
			return
		}

		cfg := repo.Config()

		if cfg.DeletionTimestamp != nil && !cfg.DeletionTimestamp.IsZero() {
			responder.Error(apierrors.NewConflict(
				provisioning.RepositoryResourceInfo.GroupResource(),
				"cannot create jobs for a repository marked for deletion",
				fmt.Errorf("cannot create jobs for a repository marked for deletion"),
			))
			return
		}

		if idx > 0 {
			responder.Error(apierrors.NewBadRequest("can not post to a job UID"))
			return
		}

		spec := provisioning.JobSpec{}
		if err := unmarshalJSON(r, defaultMaxBodySize, &spec); err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding provisioning.Job from request"))
			return
		}
		spec.Repository = name

		// Validate write operations before queueing the job
		requiresWrite := spec.Action == provisioning.JobActionDelete ||
			spec.Action == provisioning.JobActionMove ||
			spec.Action == provisioning.JobActionPush ||
			spec.Action == provisioning.JobActionMigrate

		if requiresWrite {
			var targetRef string
			switch spec.Action {
			case provisioning.JobActionDelete:
				if spec.Delete != nil {
					targetRef = spec.Delete.Ref
				}
			case provisioning.JobActionMove:
				if spec.Move != nil {
					targetRef = spec.Move.Ref
				}
			case provisioning.JobActionPush:
				if spec.Push != nil {
					targetRef = spec.Push.Branch
				}
			case provisioning.JobActionMigrate:
				// Migrate operates on the default branch (no ref)
				targetRef = ""
			default:
				// Read-only operations (Pull, PullRequest, FixFolderMetadata) don't reach here
				// due to requiresWrite check, but include default for exhaustive linter
				targetRef = ""
			}

			if err := repository.IsWriteAllowed(cfg, targetRef); err != nil {
				responder.Error(err)
				return
			}
		}

		if spec.Action == provisioning.JobActionDelete || spec.Action == provisioning.JobActionMove {
			if err := c.authorizeJobTargets(r.Context(), repo, cfg, spec); err != nil {
				responder.Error(err)
				return
			}
		}

		job, err := c.jobs.GetJobQueue().Insert(ctx, cfg.Namespace, spec)
		if err != nil {
			responder.Error(err)
			return
		}

		// For pull jobs update the sync status
		// patch the sync status 'state' to 'pending', and reset the 'started' field, leaving other fields unchanged.
		// Intentionally maintain the previous job name until the jobs is picked up.
		if spec.Pull != nil {
			err = c.statusPatcherProvider.GetStatusPatcher().Patch(ctx, cfg,
				map[string]interface{}{
					"op":    "replace",
					"path":  "/status/sync/state",
					"value": provisioning.JobStatePending,
				},
				map[string]interface{}{
					// Use "replace" instead of "remove" since "remove" fails if the path does not exist (RFC 6902).
					// "started" field uses "omitempty", so it may be missing in the JSON.
					"op":    "replace",
					"path":  "/status/sync/started",
					"value": int64(0),
				},
			)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		responder.Object(http.StatusAccepted, job)
	}), 30*time.Second), nil
}

var (
	_ rest.Connecter       = (*jobsConnector)(nil)
	_ rest.Storage         = (*jobsConnector)(nil)
	_ rest.StorageMetadata = (*jobsConnector)(nil)
)

// authorizeJobTargets checks that the requesting user has permission on the resources
// targeted by a delete or move job. This runs at job creation time while the user's
// identity is still in the request context, since jobs execute later as the
// provisioning service identity.
//
// For path-based targeting, folder permissions are checked (inheritance covers contents).
// For ResourceRef-based targeting, each resource is checked individually.
// Move jobs additionally require create permission on the target folder.
func (c *jobsConnector) authorizeJobTargets(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	var paths []string
	var resourceRefs []provisioning.ResourceRef
	var targetPath string

	switch spec.Action {
	case provisioning.JobActionDelete:
		if spec.Delete != nil {
			paths = spec.Delete.Paths
			resourceRefs = spec.Delete.Resources
		}
	case provisioning.JobActionMove:
		if spec.Move != nil {
			paths = spec.Move.Paths
			resourceRefs = spec.Move.Resources
			targetPath = spec.Move.TargetPath
		}
	default:
		return nil
	}

	if err := c.authorizePaths(ctx, cfg, paths, utils.VerbDelete); err != nil {
		return err
	}

	if err := c.authorizeResourceRefs(ctx, repo, cfg, resourceRefs, utils.VerbDelete); err != nil {
		return err
	}

	if spec.Action == provisioning.JobActionMove && targetPath != "" {
		if err := c.authorizeTargetFolder(ctx, cfg, targetPath); err != nil {
			return err
		}
	}

	return nil
}

// authorizePaths checks folder-level permissions for path-based job targets.
// Directory paths check the folder directly; file paths check their parent folder.
// Checks are deduplicated by folder UID.
func (c *jobsConnector) authorizePaths(ctx context.Context, cfg *provisioning.Repository, paths []string, verb string) error {
	checked := make(map[string]struct{})

	for _, p := range paths {
		folderUID := folderUIDForPath(cfg, p)

		if _, ok := checked[folderUID]; ok {
			continue
		}
		checked[folderUID] = struct{}{}

		if safepath.IsDir(p) {
			if err := c.access.Check(ctx, authlib.CheckRequest{
				Group:    resources.FolderResource.Group,
				Resource: resources.FolderResource.Resource,
				Name:     folderUID,
				Verb:     verb,
			}, folderUID); err != nil {
				return err
			}
		} else {
			if err := c.access.Check(ctx, authlib.CheckRequest{
				Group:    resources.DashboardResource.Group,
				Resource: resources.DashboardResource.Resource,
				Verb:     verb,
			}, folderUID); err != nil {
				return err
			}
		}
	}

	return nil
}

// authorizeResourceRefs checks permissions for ResourceRef-based job targets.
// Each resource is resolved to its file path, then authorized via its folder.
func (c *jobsConnector) authorizeResourceRefs(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, refs []provisioning.ResourceRef, verb string) error {
	if len(refs) == 0 {
		return nil
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return apierrors.NewBadRequest("repository does not support resource resolution")
	}

	repoResources, err := c.resourcesFactory.Client(ctx, rw)
	if err != nil {
		return fmt.Errorf("create repository resources client: %w", err)
	}

	for _, ref := range refs {
		gvk := schema.GroupVersionKind{
			Group: ref.Group,
			Kind:  ref.Kind,
		}

		filePath, err := repoResources.FindResourcePath(ctx, ref.Name, gvk)
		if err != nil {
			return fmt.Errorf("resolve resource %s/%s: %w", ref.Kind, ref.Name, err)
		}

		folderUID := folderUIDForPath(cfg, filePath)

		if err := c.access.Check(ctx, authlib.CheckRequest{
			Group:    ref.Group,
			Resource: gvkToResource(gvk),
			Name:     ref.Name,
			Verb:     verb,
		}, folderUID); err != nil {
			return err
		}
	}

	return nil
}

// authorizeTargetFolder checks that the user has create permission on the
// destination folder for move operations.
func (c *jobsConnector) authorizeTargetFolder(ctx context.Context, cfg *provisioning.Repository, targetPath string) error {
	parentFolder := ""
	if targetPath != "" {
		parentPath := safepath.Dir(targetPath)
		if parentPath != "" {
			parentFolder = resources.ParseFolder(parentPath, cfg.Name).ID
		} else {
			parentFolder = resources.RootFolder(cfg)
		}
	}

	return c.access.Check(ctx, authlib.CheckRequest{
		Group:    resources.FolderResource.Group,
		Resource: resources.FolderResource.Resource,
		Name:     "",
		Verb:     utils.VerbCreate,
	}, parentFolder)
}

// folderUIDForPath derives the Grafana folder UID from a repository file or directory path.
func folderUIDForPath(cfg *provisioning.Repository, filePath string) string {
	if safepath.IsDir(filePath) {
		return resources.ParseFolder(filePath, cfg.Name).ID
	}

	return resources.ParentFolder(filePath, cfg)
}

// gvkToResource converts a GroupVersionKind to its plural resource name.
// This follows the Kubernetes convention of lowercasing the kind and appending "s".
func gvkToResource(gvk schema.GroupVersionKind) string {
	return strings.ToLower(gvk.Kind) + "s"
}

// ValidUUID ensures the ID is valid for a blob.
// The ID is always a UUID. As such, this checks for something that can resemble a UUID.
// This does not check for the ID to be an actual UUID, as the blob store may change their ID format, which we do not wish to stand in the way of.
func ValidUUID(id string) bool {
	for _, c := range id {
		// [a-zA-Z0-9\-] are valid characters.
		az := c >= 'a' && c <= 'z'
		AZ := c >= 'A' && c <= 'Z'
		digit := c >= '0' && c <= '9'
		if !az && !AZ && !digit && c != '-' {
			return false
		}
	}
	return true
}
