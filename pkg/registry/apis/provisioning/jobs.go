package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
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
	clients               resources.ClientFactory
	folderMetadataEnabled bool
}

func NewJobsConnector(
	repoGetter RepoGetter,
	statusPatcherProvider StatusPatcherProvider,
	jobs JobQueueGetter,
	historic jobs.HistoryReader,
	access auth.AccessChecker,
	clients resources.ClientFactory,
	folderMetadataEnabled bool,
) *jobsConnector {
	return &jobsConnector{
		repoGetter:            repoGetter,
		statusPatcherProvider: statusPatcherProvider,
		jobs:                  jobs,
		historic:              historic,
		access:                access,
		clients:               clients,
		folderMetadataEnabled: folderMetadataEnabled,
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

		if err := c.authorizeJob(r.Context(), repo, cfg, spec); err != nil {
			responder.Error(err)
			return
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

// authorizeJob dispatches pre-flight authorization checks based on the job action.
func (c *jobsConnector) authorizeJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	switch spec.Action {
	case provisioning.JobActionPush, provisioning.JobActionMigrate:
		return c.authorizeResourceJob(ctx, repo, cfg, spec)
	case provisioning.JobActionDelete:
		if spec.Delete != nil {
			return c.authorizeDeleteJob(ctx, repo, cfg, spec.Delete)
		}
	case provisioning.JobActionMove:
		if spec.Move != nil {
			return c.authorizeMoveJob(ctx, repo, cfg, spec.Move)
		}
	case provisioning.JobActionPull, provisioning.JobActionPullRequest, provisioning.JobActionFixFolderMetadata:
		// Read-only operations don't require pre-flight resource authorization.
	}
	return nil
}

// newJobAuthorizer creates an Authorizer for the given repository. Returns an error
// if the repository does not implement Reader.
func (c *jobsConnector) newJobAuthorizer(repo repository.Repository, cfg *provisioning.Repository) (resources.Authorizer, error) {
	reader, ok := repo.(repository.Reader)
	if !ok {
		return nil, apierrors.NewBadRequest("repository does not support reading")
	}
	return resources.NewAuthorizer(cfg, reader, c.access, c.folderMetadataEnabled), nil
}

// authorizeResourceRefs fetches each referenced resource and checks that the user
// has the given verb permission on it. Resources that no longer exist are skipped.
func (c *jobsConnector) authorizeResourceRefs(ctx context.Context, authorizer resources.Authorizer, namespace string, refs []provisioning.ResourceRef, verb, action string) error {
	if len(refs) == 0 {
		return nil
	}

	clients, err := c.clients.Clients(ctx, namespace)
	if err != nil {
		return fmt.Errorf("create clients for authorization: %w", err)
	}

	for _, ref := range refs {
		gvk := schema.GroupVersionKind{Group: ref.Group, Kind: ref.Kind}
		client, gvr, err := clients.ForKind(ctx, gvk)
		if err != nil {
			return fmt.Errorf("get client for %s/%s: %w", ref.Group, ref.Kind, err)
		}

		obj, err := client.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				continue
			}
			return fmt.Errorf("authorize %s resource %s/%s/%s: %w", action, ref.Group, ref.Kind, ref.Name, err)
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return fmt.Errorf("get metadata for %s/%s/%s: %w", ref.Group, ref.Kind, ref.Name, err)
		}

		parsed := &resources.ParsedResource{
			Existing: obj,
			Obj:      obj,
			Meta:     meta,
			GVR:      gvr,
		}
		if err := authorizer.AuthorizeResource(ctx, parsed, verb); err != nil {
			return fmt.Errorf("authorize %s %s/%s/%s: %w", action, ref.Group, ref.Kind, ref.Name, err)
		}
	}
	return nil
}

// authorizeResourceJob checks that the requesting user has the required permissions
// for operations that read and write all supported resource types (export and migrate).
// This runs at job creation time while the user's identity is still in the request
// context, since the job executes later as the provisioning service identity.
//
// Delegates to the resources.Authorizer which checks:
//  1. Read permission on all supported resource types at root level.
//  2. Create permission on all supported resource types in the target folder.
func (c *jobsConnector) authorizeResourceJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	if spec.Push == nil && spec.Migrate == nil {
		return nil
	}

	authorizer, err := c.newJobAuthorizer(repo, cfg)
	if err != nil {
		return err
	}
	if err := authorizer.AuthorizeReadAllSupported(ctx); err != nil {
		return err
	}
	return authorizer.AuthorizeCreateAllSupported(ctx)
}

// authorizeDeleteJob checks delete permissions on targeted paths and resources.
func (c *jobsConnector) authorizeDeleteJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, opts *provisioning.DeleteJobOptions) error {
	authorizer, err := c.newJobAuthorizer(repo, cfg)
	if err != nil {
		return err
	}

	for _, path := range opts.Paths {
		if err := authorizer.AuthorizeDeleteByPath(ctx, path); err != nil {
			return fmt.Errorf("authorize delete %q: %w", path, err)
		}
	}

	return c.authorizeResourceRefs(ctx, authorizer, cfg.Namespace, opts.Resources, utils.VerbDelete, "delete")
}

// authorizeMoveJob checks update permission on sources and create permission on targets.
func (c *jobsConnector) authorizeMoveJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, opts *provisioning.MoveJobOptions) error {
	authorizer, err := c.newJobAuthorizer(repo, cfg)
	if err != nil {
		return err
	}

	for _, path := range opts.Paths {
		if err := authorizer.AuthorizeMoveByPath(ctx, path, opts.TargetPath); err != nil {
			return fmt.Errorf("authorize move %q: %w", path, err)
		}
	}

	return c.authorizeResourceRefs(ctx, authorizer, cfg.Namespace, opts.Resources, utils.VerbUpdate, "move")
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
