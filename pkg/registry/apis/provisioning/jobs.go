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
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
			c.handleGetJob(ctx, r.URL.Path, name, prefix, idx, responder)
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

		if jobs.IsOrphanCleanupAction(spec.Action) {
			c.handleOrphanCleanupJob(ctx, r, name, spec, responder)
			return
		}

		c.handleCreateJob(ctx, r, name, spec, responder)
	}), 30*time.Second), nil
}

// handleGetJob serves GET requests for job history — either a single job by
// UID or the recent jobs list for a repository.
// The namespace is resolved from the request context so that callers can
// retrieve job results even when the repository has been deleted (e.g. orphan
// cleanup jobs).
func (c *jobsConnector) handleGetJob(ctx context.Context, urlPath, name, prefix string, idx int, responder rest.Responder) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		responder.Error(apierrors.NewBadRequest("missing namespace"))
		return
	}

	if idx > 0 {
		jobUID := urlPath[idx+len(prefix):]
		if !ValidUUID(jobUID) {
			responder.Error(apierrors.NewBadRequest(fmt.Sprintf("invalid job uid: %s", jobUID)))
			return
		}
		job, err := c.historic.GetJob(ctx, ns, name, jobUID)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, job)
		return
	}

	recent, err := c.historic.RecentJobs(ctx, ns, name)
	if err != nil {
		responder.Error(err)
		return
	}
	responder.Object(http.StatusOK, recent)
}

// handleCreateJob handles POST requests to create a new job for a healthy repository.
func (c *jobsConnector) handleCreateJob(ctx context.Context, r *http.Request, name string, spec provisioning.JobSpec, responder rest.Responder) {
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

	if spec.Action == provisioning.JobActionPull {
		if err := c.authorizeAdminJob(r.Context(), cfg); err != nil {
			responder.Error(err)
			return
		}
	}

	if err := c.validateWriteAccess(cfg, spec); err != nil {
		responder.Error(err)
		return
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

	if spec.Pull != nil {
		err = c.statusPatcherProvider.GetStatusPatcher().Patch(ctx, cfg,
			map[string]interface{}{
				"op":    "replace",
				"path":  "/status/sync/state",
				"value": provisioning.JobStatePending,
			},
			map[string]interface{}{
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
}

// validateWriteAccess checks if a write operation is allowed for the given
// repository and job spec. Returns nil for read-only actions.
func (c *jobsConnector) validateWriteAccess(cfg *provisioning.Repository, spec provisioning.JobSpec) error {
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
	case provisioning.JobActionFixFolderMetadata:
		if spec.FixFolderMetadata != nil {
			targetRef = spec.FixFolderMetadata.Ref
		}
	case provisioning.JobActionMigrate:
		// no ref needed
	default:
		return nil
	}
	return repository.IsWriteAllowed(cfg, targetRef)
}

var (
	_ rest.Connecter       = (*jobsConnector)(nil)
	_ rest.Storage         = (*jobsConnector)(nil)
	_ rest.StorageMetadata = (*jobsConnector)(nil)
)

// handleOrphanCleanupJob handles job creation for releaseResources and deleteResources
// actions. These have inverted validation compared to normal jobs: they are only allowed
// when the repository does NOT exist or is stuck in Terminating state.
func (c *jobsConnector) handleOrphanCleanupJob(ctx context.Context, r *http.Request, name string, spec provisioning.JobSpec, responder rest.Responder) {
	ns, ok := request.NamespaceFrom(ctx)
	if !ok {
		responder.Error(apierrors.NewBadRequest("missing namespace"))
		return
	}

	repo, err := c.repoGetter.GetRepository(ctx, name)
	if err == nil {
		cfg := repo.Config()
		if cfg.DeletionTimestamp == nil || cfg.DeletionTimestamp.IsZero() {
			responder.Error(apierrors.NewConflict(
				provisioning.RepositoryResourceInfo.GroupResource(),
				name,
				fmt.Errorf("repository exists and is not being deleted; use the normal delete flow"),
			))
			return
		}
	} else if !apierrors.IsNotFound(err) {
		responder.Error(err)
		return
	}

	if err := c.authorizeAdminJob(r.Context(), &provisioning.Repository{
		ObjectMeta: metav1.ObjectMeta{Namespace: ns},
	}); err != nil {
		responder.Error(err)
		return
	}

	job, err := c.jobs.GetJobQueue().Insert(ctx, ns, spec)
	if err != nil {
		responder.Error(err)
		return
	}
	responder.Object(http.StatusAccepted, job)
}

// authorizeJob dispatches pre-flight validation and authorization checks based on the job action.
func (c *jobsConnector) authorizeJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	if spec.Action == provisioning.JobActionPullRequest {
		return apierrors.NewBadRequest("pull request jobs cannot be created via the API; they are triggered by webhooks")
	}
	if spec.Action == provisioning.JobActionFixFolderMetadata && !c.folderMetadataEnabled {
		return apierrors.NewBadRequest("fixFolderMetadata jobs require the provisioningFolderMetadata feature flag")
	}

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
		// Pull is authorized inline in Connect.
	case provisioning.JobActionReleaseResources, provisioning.JobActionDeleteResources:
		// Orphan cleanup actions are handled separately via handleOrphanCleanupJob
		// and never reach authorizeJob.
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

// authorizeAdminJob checks that the requesting user has admin privileges.
// Used for job types that are restricted to administrators.
func (c *jobsConnector) authorizeAdminJob(ctx context.Context, cfg *provisioning.Repository) error {
	return c.access.WithFallbackRole(identity.RoleAdmin).Check(ctx, authlib.CheckRequest{
		Verb:      "create",
		Group:     provisioning.GROUP,
		Resource:  provisioning.JobResourceInfo.GetName(),
		Namespace: cfg.Namespace,
	}, "")
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
