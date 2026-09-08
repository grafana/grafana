package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	perfTestingEnabled    func(ctx context.Context) bool
}

func NewJobsConnector(
	repoGetter RepoGetter,
	statusPatcherProvider StatusPatcherProvider,
	jobs JobQueueGetter,
	historic jobs.HistoryReader,
	access auth.AccessChecker,
	clients resources.ClientFactory,
	folderMetadataEnabled bool,
	perfTestingEnabled func(ctx context.Context) bool,
) *jobsConnector {
	return &jobsConnector{
		repoGetter:            repoGetter,
		statusPatcherProvider: statusPatcherProvider,
		jobs:                  jobs,
		historic:              historic,
		access:                access,
		clients:               clients,
		folderMetadataEnabled: folderMetadataEnabled,
		perfTestingEnabled:    perfTestingEnabled,
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
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
	}), nil
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

	if spec.Action == provisioning.JobActionPull || spec.Action == provisioning.JobActionTest {
		if err := c.authorizeAdminJob(ctx, cfg); err != nil {
			responder.Error(err)
			return
		}
	}

	if err := c.validateWriteAccess(cfg, spec); err != nil {
		responder.Error(err)
		return
	}

	if err := c.authorizeJob(ctx, repo, cfg, spec); err != nil {
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
		if spec.Migrate != nil {
			// An empty branch, or one equal to the configured branch, is a direct
			// write with takeover (not a pull request); a different branch is the
			// branch workflow. IsWriteAllowed normalizes the equal-to-configured
			// case, so pass the branch straight through.
			targetRef = spec.Migrate.Branch
		}
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

	if err := c.authorizeAdminJob(ctx, &provisioning.Repository{
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
	if spec.Action == provisioning.JobActionTest && (c.perfTestingEnabled == nil || !c.perfTestingEnabled(ctx)) {
		return apierrors.NewBadRequest("test jobs require the provisioning.performance feature flag")
	}

	exportEnabled := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagProvisioningExport, false, openfeature.TransactionContext(ctx))
	// Reject export (push) and migrate jobs up front when the feature is disabled,
	// so the API user gets a clear error at creation time instead of a job that is
	// created only to complete as a no-op.
	if spec.Action == provisioning.JobActionPush && !exportEnabled {
		return apierrors.NewBadRequest("push jobs require the provisioningExport feature flag")
	}
	if spec.Action == provisioning.JobActionMigrate && !exportEnabled {
		return apierrors.NewBadRequest("migrate jobs require the provisioningExport feature flag")
	}

	switch spec.Action {
	case provisioning.JobActionPush:
		// The jobs subresource no longer gates job creation on provisioning.jobs:create
		// (see authorizeRepositorySubresource), so push must re-require Editor here.
		// authorizePushJob only checks read permission, which is too weak on its own.
		if err := c.authorizeEditorJob(ctx, cfg); err != nil {
			return err
		}
		return c.authorizePushJob(ctx, repo, cfg)
	case provisioning.JobActionMigrate:
		// Same as push: migrate must stay Editor-only.
		if err := c.authorizeEditorJob(ctx, cfg); err != nil {
			return err
		}
		return c.authorizeMigrateJob(ctx, repo, cfg, spec)
	case provisioning.JobActionDelete:
		if spec.Delete != nil {
			return c.authorizeDeleteJob(ctx, repo, cfg, spec.Delete.Paths, spec.Delete.Resources, spec.Delete.Ref, true)
		}
	case provisioning.JobActionMove:
		if spec.Move != nil {
			return c.authorizeMoveJob(ctx, repo, cfg, spec.Move)
		}
	case provisioning.JobActionFixFolderMetadata:
		// fixFolderMetadata has no path/resource-level checks of its own, so it must
		// stay Editor-only now that job creation isn't gated on jobs:create up front.
		if err := c.authorizeEditorJob(ctx, cfg); err != nil {
			return err
		}
	case provisioning.JobActionPull, provisioning.JobActionPullRequest, provisioning.JobActionTest:
		// Read-only / no-op operations don't require pre-flight resource authorization.
		// Pull and test are authorized inline in handleCreateJob (admin-only).
	case provisioning.JobActionReleaseResources, provisioning.JobActionDeleteResources:
		// Orphan cleanup actions are handled separately via handleOrphanCleanupJob
		// and never reach authorizeJob.
	}
	return nil
}

// authorizeEditorJob checks provisioning.jobs:create with the Editor fallback role.
// Used for job actions that have no path/resource-level authorization of their own
// and so must stay Editor-only now that the jobs subresource lets any authenticated
// user attempt job creation (see authorizeRepositorySubresource).
func (c *jobsConnector) authorizeEditorJob(ctx context.Context, cfg *provisioning.Repository) error {
	return c.access.WithFallbackRole(identity.RoleEditor).Check(ctx, authlib.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     provisioning.GROUP,
		Resource:  provisioning.JobResourceInfo.GetName(),
		Namespace: cfg.Namespace,
	}, "")
}

// newJobAuthorizer creates an Authorizer for the given repository. Returns an error
// if the repository does not implement Reader.
func (c *jobsConnector) newJobAuthorizer(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository) (resources.Authorizer, error) {
	reader, ok := repo.(repository.Reader)
	if !ok {
		return nil, apierrors.NewBadRequest("repository does not support reading")
	}
	clients, err := c.clients.Clients(ctx, cfg.Namespace)
	if err != nil {
		return nil, fmt.Errorf("create clients for authorization: %w", err)
	}
	return resources.NewAuthorizer(cfg, reader, c.access, clients, c.folderMetadataEnabled), nil
}

// wrapAuthzError adds context to an authorization decision error while preserving
// its HTTP status. fmt.Errorf's %w wrapping breaks status-code propagation here:
// the apiserver extracts the response status via a type switch on the concrete
// error type (k8s.io/apiserver/pkg/endpoints/handlers/responsewriters.ErrorToAPIStatus),
// not errors.As, so a %w-wrapped apierrors.APIStatus (e.g. Forbidden) would
// otherwise render as a 500 Internal Server Error instead of its real status.
func wrapAuthzError(err error, format string, args ...any) error {
	msg := fmt.Sprintf(format, args...)
	if statusErr, ok := err.(apierrors.APIStatus); ok {
		status := statusErr.Status()
		status.Message = fmt.Sprintf("%s: %s", msg, status.Message)
		return &apierrors.StatusError{ErrStatus: status}
	}
	return fmt.Errorf("%s: %w", msg, err)
}

// authorizeResourceRefs fetches each referenced resource and checks that the user
// has the given verb permission on it. Refs that no longer exist are skipped.
//
// When requireManaged is true, refs that aren't managed by repoName are also
// skipped rather than authorized - a ResourceRef only carries a name/kind/group,
// with nothing tying it to the repository the job was created against, so a ref
// could otherwise name a resource the caller controls in a different repository
// whose file path happens to collide with a protected path in this one. Skipping
// mismatched refs here mirrors the same check the worker applies when it later
// resolves the ref to a path (RepositoryResources.FindResourcePath). Pass false
// only for callers whose resources are legitimately unmanaged by this repository
// (e.g. a selective migration's export inputs) and whose execution path doesn't
// resolve refs to this repository's file paths, so the collision this guards
// against doesn't apply.
//
// Returns the set of distinct GVRs among refs that were actually found, owned
// (if required), and authorized. Callers use this to detect a request that named
// only unusable resources, which must not be treated as vacuously authorized
// (see authorizeDeleteJob/authorizeMoveJob), and to restrict any further
// target-folder check to only the kinds that will actually be acted on (see
// authorizeMoveJob's call to authorizeCreateInFolder) - a ref skipped here is
// also skipped by the worker, so checking its target permission would
// incorrectly deny requests that mix a usable ref with one that's ignored.
func (c *jobsConnector) authorizeResourceRefs(ctx context.Context, authorizer resources.Authorizer, namespace, repoName string, refs []provisioning.ResourceRef, verb, action string, requireManaged bool) (map[schema.GroupVersionResource]bool, error) {
	if len(refs) == 0 {
		return nil, nil
	}

	clients, err := c.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("create clients for authorization: %w", err)
	}

	found := map[schema.GroupVersionResource]bool{}
	for _, ref := range refs {
		gvk := schema.GroupVersionKind{Group: ref.Group, Kind: ref.Kind}
		client, gvr, err := clients.ForKind(ctx, gvk)
		if err != nil {
			return found, fmt.Errorf("get client for %s/%s: %w", ref.Group, ref.Kind, err)
		}

		obj, err := client.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				continue
			}
			return found, wrapAuthzError(err, "authorize %s resource %s/%s/%s", action, ref.Group, ref.Kind, ref.Name)
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return found, fmt.Errorf("get metadata for %s/%s/%s: %w", ref.Group, ref.Kind, ref.Name, err)
		}

		if requireManaged {
			if manager, ok := meta.GetManagerProperties(); !ok || manager.Kind != utils.ManagerKindRepo || manager.Identity != repoName {
				continue
			}
		}

		parsed := &resources.ParsedResource{
			Existing: obj,
			Obj:      obj,
			Meta:     meta,
			GVR:      gvr,
		}
		if err := authorizer.AuthorizeResource(ctx, parsed, verb); err != nil {
			return found, wrapAuthzError(err, "authorize %s %s/%s/%s", action, ref.Group, ref.Kind, ref.Name)
		}
		found[gvr] = true
	}
	return found, nil
}

// authorizeAdminJob checks that the requesting user has admin privileges.
// Used for job types that are restricted to administrators.
//
// We check repositories:write (an admin-only RBAC action) rather than
// jobs:create, because jobs:create is granted to Editor and would let editors
// trigger admin-restricted jobs (pull, releaseResources, deleteResources).
// The fallback role still allows admins whose RBAC isn't explicitly set up.
func (c *jobsConnector) authorizeAdminJob(ctx context.Context, cfg *provisioning.Repository) error {
	return c.access.WithFallbackRole(identity.RoleAdmin).Check(ctx, authlib.CheckRequest{
		Verb:      utils.VerbUpdate,
		Group:     provisioning.GROUP,
		Resource:  provisioning.RepositoryResourceInfo.GetName(),
		Namespace: cfg.Namespace,
	}, "")
}

// authorizePushJob checks that the requesting user may read every supported
// resource type. A push job only exports resources to the repository (it reads
// them and writes files to git); it never creates or deletes Grafana resources,
// so read permission is sufficient.
//
// This runs at job creation time while the user's identity is still in the
// request context, since the job executes later as the provisioning service
// identity (which can read everything) — without this check a user could export
// resources they are not allowed to read.
func (c *jobsConnector) authorizePushJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository) error {
	authorizer, err := c.newJobAuthorizer(ctx, repo, cfg)
	if err != nil {
		return err
	}
	return authorizer.AuthorizeReadAllSupported(ctx)
}

// authorizeResourceJob checks that the requesting user has the required permissions
// for a migration, which reads and writes all supported resource types.
// This runs at job creation time while the user's identity is still in the request
// context, since the job executes later as the provisioning service identity.
//
// Delegates to the resources.Authorizer which checks:
//  1. Read permission on all supported resource types at root level.
//  2. Create permission on all supported resource types in the target folder.
func (c *jobsConnector) authorizeResourceJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	authorizer, err := c.newJobAuthorizer(ctx, repo, cfg)
	if err != nil {
		return err
	}
	if err := authorizer.AuthorizeReadAllSupported(ctx); err != nil {
		return err
	}
	return authorizer.AuthorizeCreateAllSupported(ctx)
}

func (c *jobsConnector) authorizeMigrateJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, spec provisioning.JobSpec) error {
	if spec.Migrate == nil {
		return nil
	}

	if err := c.authorizeResourceJob(ctx, repo, cfg, spec); err != nil {
		return err
	}

	// When deletion is skipped the migration removes nothing, so no delete
	// permission is required (read + create above is enough).
	if spec.Migrate.SkipResourceDeletion {
		return nil
	}

	// Require delete permission only for what the migration will actually remove,
	// mirroring UnifiedStorageMigrator:
	//   - instance/unset targets always clean the whole namespace → delete-all.
	//   - folder/folderless coexist with unmanaged resources and only delete on a
	//     branch migration (the exported resources); a configured-branch migration
	//     just exports and pulls, so it needs no delete permission.
	branchMigration := spec.Migrate.Branch != "" && spec.Migrate.Branch != cfg.Branch()
	selective := len(spec.Migrate.Resources) > 0

	switch cfg.Spec.Sync.Target {
	case provisioning.SyncTargetTypeFolder, provisioning.SyncTargetTypeFolderless:
		switch {
		case !branchMigration:
			// Export + pull (takeover) only; nothing is deleted from the instance.
			return nil
		case selective:
			// Deletes only the chosen resources. These are intentionally unmanaged
			// by this repository (the migration exports them, then CleanResources
			// removes only unmanaged resources), so requireManaged must be false
			// here - unlike a real delete/move job, requiring manager ownership
			// would reject every legitimate selective migration input.
			return c.authorizeDeleteJob(ctx, repo, cfg, nil, spec.Migrate.Resources, "", false)
		default:
			// A full branch migration deletes every exported resource.
			return c.authorizeDeleteAllSupported(ctx, repo, cfg)
		}
	default:
		// Instance (and an unset target, which defaults to instance) always wipes
		// the namespace.
		return c.authorizeDeleteAllSupported(ctx, repo, cfg)
	}
}

// authorizeDeleteAllSupported checks that the user may delete every supported
// resource type (used before migrations that remove all instance resources).
func (c *jobsConnector) authorizeDeleteAllSupported(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository) error {
	authorizer, err := c.newJobAuthorizer(ctx, repo, cfg)
	if err != nil {
		return err
	}
	return authorizer.AuthorizeDeleteAllSupported(ctx)
}

// authorizeDeleteJob checks delete permissions on targeted paths and resources.
//
// A delete job with no paths and no resources isn't a no-op: when Ref is empty,
// the worker follows an empty delete with a full non-incremental sync (the only
// way it supports removing an entire folder), which is the same effect as the
// admin-only manual pull. Without this check, that full-sync side effect would be
// reachable by anyone who can pass the per-path/resource checks below (trivially,
// since there are none to check), rather than being gated like a real pull.
//
// requireManaged is threaded through to authorizeResourceRefs - see its doc.
func (c *jobsConnector) authorizeDeleteJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, paths []string, resources []provisioning.ResourceRef, ref string, requireManaged bool) error {
	if len(paths) == 0 && len(resources) == 0 {
		return apierrors.NewBadRequest("delete jobs must target at least one path or resource")
	}

	// Path-based checks below (AuthorizeDeleteByPath) read file and folder
	// identity from the repository's configured branch - ProvisioningAuthorizer
	// has no concept of ref. If the request targets a different branch, that
	// read can diverge from what the worker actually deletes there under the
	// provisioning identity, so require Editor instead - the same protection
	// this had before per-path checks became reachable by non-Editors.
	// Resource-ref checks aren't affected: they authorize against the resource's
	// live Grafana state, not git content at a specific ref.
	if len(paths) > 0 && ref != "" && ref != cfg.Branch() {
		return c.authorizeEditorJob(ctx, cfg)
	}

	authorizer, err := c.newJobAuthorizer(ctx, repo, cfg)
	if err != nil {
		return err
	}

	for _, path := range paths {
		if err := authorizer.AuthorizeDeleteByPath(ctx, path); err != nil {
			return wrapAuthzError(err, "authorize delete %q", path)
		}
	}

	found, err := c.authorizeResourceRefs(ctx, authorizer, cfg.Namespace, cfg.Name, resources, utils.VerbDelete, "delete", requireManaged)
	if err != nil {
		return err
	}
	// Resources that don't exist, or aren't managed by this repository, are skipped
	// above rather than rejected outright (matching how the worker resolves them
	// later), so a request naming only such resources must still be rejected here -
	// otherwise it would authorize nothing and fall through to the same trivial
	// success the empty-target check above guards against.
	if len(paths) == 0 && len(found) == 0 {
		return apierrors.NewBadRequest("delete jobs must target at least one existing path or resource")
	}
	return nil
}

// authorizeMoveJob checks update permission on sources and create permission on targets.
//
// Like delete, an empty Paths+Resources move isn't a no-op given how the worker
// handles an empty ref, so it's rejected outright rather than trivially authorized.
func (c *jobsConnector) authorizeMoveJob(ctx context.Context, repo repository.Repository, cfg *provisioning.Repository, opts *provisioning.MoveJobOptions) error {
	if len(opts.Paths) == 0 && len(opts.Resources) == 0 {
		return apierrors.NewBadRequest("move jobs must target at least one path or resource")
	}

	// See the identical guard in authorizeDeleteJob: path-based checks aren't
	// ref-aware, so a request targeting a different branch than configured
	// falls back to requiring Editor.
	if len(opts.Paths) > 0 && opts.Ref != "" && opts.Ref != cfg.Branch() {
		return c.authorizeEditorJob(ctx, cfg)
	}

	authorizer, err := c.newJobAuthorizer(ctx, repo, cfg)
	if err != nil {
		return err
	}

	for _, path := range opts.Paths {
		if err := authorizer.AuthorizeMoveByPath(ctx, path, opts.TargetPath); err != nil {
			return wrapAuthzError(err, "authorize move %q", path)
		}
	}

	foundGVRs, err := c.authorizeResourceRefs(ctx, authorizer, cfg.Namespace, cfg.Name, opts.Resources, utils.VerbUpdate, "move", true)
	if err != nil {
		return err
	}
	if len(opts.Paths) == 0 && len(foundGVRs) == 0 {
		return apierrors.NewBadRequest("move jobs must target at least one existing path or resource")
	}

	// authorizeResourceRefs only checks update on the source above. Path-based moves
	// also require create on the target (AuthorizeMoveByPath), so resource-based moves
	// need the equivalent target-folder check to avoid moving into a folder the user
	// can't create in. Only check the GVRs that were actually found and authorized -
	// a skipped ref is also skipped by the worker, so its target permission is moot.
	return c.authorizeCreateInFolder(ctx, authorizer, foundGVRs, opts.TargetPath)
}

// authorizeCreateInFolder checks create permission on the destination folder for
// each GVR in gvrs, mirroring the target-folder check that AuthorizeMoveByPath
// already performs for path-based moves. There's no source file path to preserve
// a basename from for resource-ref moves - the worker resolves each ref to a path
// and then joins it into targetPath the same way, so the folder to check create
// on is targetPath directly (see AuthorizeCreateInFolder on the Authorizer).
func (c *jobsConnector) authorizeCreateInFolder(ctx context.Context, authorizer resources.Authorizer, gvrs map[schema.GroupVersionResource]bool, targetPath string) error {
	for gvr := range gvrs {
		if err := authorizer.AuthorizeCreateInFolder(ctx, gvr, targetPath); err != nil {
			return wrapAuthzError(err, "authorize move target %q", targetPath)
		}
	}
	return nil
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
