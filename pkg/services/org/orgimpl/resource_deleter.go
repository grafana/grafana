package orgimpl

import (
	"context"
	"errors"
	"fmt"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/dynamic"

	rulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
	provisioningv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

// resourceDeleter is the interface used by DeletionService.
type resourceDeleter interface {
	deleteCollections(ctx context.Context, orgID int64) error
}

// k8sResourceDeleter deletes org-scoped k8s resources during org deletion.
// It routes through the k8s API server, which dispatches to either unified
// storage or legacy SQL depending on the current dual-write mode.
type k8sResourceDeleter struct {
	namespacer request.NamespaceMapper
	restConfig apiserver.RestConfigProvider
	log        log.Logger
	gvrs       []schema.GroupVersionResource
	// provisioningGVRs is swept after the repositories, which are themselves swept
	// after gvrs. See deleteCollections.
	provisioningGVRs []schema.GroupVersionResource
	stackID          string
	// repoPollInterval and repoDeletionTimeout bound the wait for repository
	// finalizers; tests shorten them.
	repoPollInterval    time.Duration
	repoDeletionTimeout time.Duration
}

func newK8sResourceDeleter(cfg *setting.Cfg, restCfg apiserver.RestConfigProvider, logger log.Logger) *k8sResourceDeleter {
	return &k8sResourceDeleter{
		namespacer: request.GetNamespaceMapper(cfg),
		restConfig: restCfg,
		log:        logger,
		gvrs:       migratedResourceGVRs(),
		stackID:    cfg.StackID,

		provisioningGVRs: provisioningGVRs(),

		repoPollInterval: 250 * time.Millisecond,
		// Short of the proxy timeouts in front of the delete request: a repository
		// that has not finished by then is left to the controller anyway.
		repoDeletionTimeout: 30 * time.Second,
	}
}

var repositoryGVR = provisioningv0alpha1.RepositoryResourceInfo.GroupVersionResource()

// errRepositoriesBlocked ends the wait early: every repository left has reported a
// failed finalizer pass, so more waiting cannot change the outcome.
var errRepositoriesBlocked = errors.New("every remaining repository reported a blocked deletion")

// migratedResourceGVRs returns the list of GVRs for resources that may have
// been migrated to unified storage and need deletion during org cleanup.
func migratedResourceGVRs() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		playlistv1.PlaylistKind().GroupVersionResource(),
		// Rules cannot be deleted while they belong to a sequence.
		rulesv0alpha1.RuleSequenceKind().GroupVersionResource(),
		rulesv0alpha1.AlertRuleKind().GroupVersionResource(),
		rulesv0alpha1.RecordingRuleKind().GroupVersionResource(),
		rulesv0alpha1.ConfigKind().GroupVersionResource(),
	}
}

// provisioningGVRs returns the provisioning GVRs that can only be deleted once the
// repositories are gone: a connection delete is rejected while a repository that
// references it is not yet terminating, and jobs belong to a repository.
func provisioningGVRs() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		provisioningv0alpha1.ConnectionResourceInfo.GroupVersionResource(),
		provisioningv0alpha1.JobResourceInfo.GroupVersionResource(),
		provisioningv0alpha1.HistoricJobResourceInfo.GroupVersionResource(),
	}
}

// deleteCollections deletes all resources for each migrated GVR in the given org.
// Errors indicating a missing or unregistered resource (NotFound, MethodNotSupported)
// are logged as warnings and do not block org deletion. All other errors are
// propagated so that the caller fails visibly when resources cannot be cleaned up.
func (d *k8sResourceDeleter) deleteCollections(ctx context.Context, orgID int64) error {
	if orgID < 1 {
		return fmt.Errorf("invalid org ID: %d", orgID)
	}
	// Cloud namespaces identify the stack, not the org. Org deletion must not
	// delete stack resources through a namespace shared with another org.
	if d.stackID != "" {
		d.log.Warn("Skipping org resource collection deletion in a Cloud namespace", "orgId", orgID, "stackId", d.stackID)
		return nil
	}

	cfg, err := d.restConfig.GetRestConfig(ctx)
	if err != nil {
		return fmt.Errorf("get rest config: %w", err)
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return fmt.Errorf("create dynamic client: %w", err)
	}

	ns := d.namespacer(orgID)

	if err := d.deleteCollectionsFor(ctx, dyn, ns, orgID, d.gvrs); err != nil {
		return err
	}

	// Repositories go last of the three steps. Their finalizer deletes the folders
	// they provisioned, and a folder is only deletable once it is empty — the sweep
	// above is what empties it of alert rules, and the dashboard sweep in the caller
	// of what it holds.
	if err := d.deleteRepositories(ctx, dyn, ns); err != nil {
		return err
	}

	return d.deleteCollectionsFor(ctx, dyn, ns, orgID, d.provisioningGVRs)
}

func (d *k8sResourceDeleter) deleteCollectionsFor(ctx context.Context, dyn dynamic.Interface, ns string, orgID int64, gvrs []schema.GroupVersionResource) error {
	for _, gvr := range gvrs {
		if err := dyn.Resource(gvr).Namespace(ns).DeleteCollection(ctx, v1.DeleteOptions{}, v1.ListOptions{}); err != nil {
			if k8serrors.IsNotFound(err) || k8serrors.IsMethodNotSupported(err) {
				d.log.Warn("Resource not available, skipping collection deletion",
					"orgId", orgID, "gvr", gvr.String(), "error", err)
				continue
			}
			return fmt.Errorf("delete collection %s: %w", gvr.String(), err)
		}
	}
	return nil
}

// deleteRepositories removes the org's provisioning repositories and waits for
// their finalizers to run, so the teardown happens while the org still exists.
// A repository whose finalizers cannot complete — a webhook that cannot be
// removed, a provisioned folder still holding a library panel — must not make
// the org undeletable, so the wait is best effort: the object is left
// terminating and the controller keeps retrying it.
func (d *k8sResourceDeleter) deleteRepositories(ctx context.Context, dyn dynamic.Interface, ns string) error {
	client := dyn.Resource(repositoryGVR).Namespace(ns)
	if err := client.DeleteCollection(ctx, v1.DeleteOptions{}, v1.ListOptions{}); err != nil {
		if k8serrors.IsNotFound(err) || k8serrors.IsMethodNotSupported(err) {
			d.log.Warn("Provisioning not available, skipping repository deletion", "namespace", ns, "error", err)
			return nil
		}
		return fmt.Errorf("delete collection %s: %w", repositoryGVR.String(), err)
	}

	var pending []string
	err := wait.PollUntilContextTimeout(ctx, d.repoPollInterval, d.repoDeletionTimeout, true,
		func(ctx context.Context) (bool, error) {
			list, err := client.List(ctx, v1.ListOptions{})
			if err != nil {
				return false, fmt.Errorf("list repositories: %w", err)
			}
			pending = pending[:0]
			blocked := 0
			for i := range list.Items {
				pending = append(pending, list.Items[i].GetName())
				if isDeletionBlocked(&list.Items[i]) {
					blocked++
				}
			}
			switch {
			case len(pending) == 0:
				return true, nil
			case blocked == len(pending):
				return false, errRepositoriesBlocked
			default:
				return false, nil
			}
		})
	if err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("wait for repositories in %s to be deleted: %w", ns, err)
		}
		d.log.Warn("Repositories did not finish deleting before the org was removed",
			"namespace", ns, "repositories", pending, "error", err)
	}
	return nil
}

// isDeletionBlocked reports whether the controller has recorded a failed finalizer
// pass on the repository. It writes status.deletion only on failure, so its
// presence is the signal that the teardown needs an operator rather than time.
func isDeletionBlocked(repo *unstructured.Unstructured) bool {
	state, _, err := unstructured.NestedString(repo.Object, "status", "deletion", "state")
	return err == nil && state == string(provisioningv0alpha1.DeletionStateBlocked)
}
