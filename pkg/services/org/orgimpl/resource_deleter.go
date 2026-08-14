package orgimpl

import (
	"context"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	playlistv1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v1"
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
}

func newK8sResourceDeleter(cfg *setting.Cfg, restCfg apiserver.RestConfigProvider, logger log.Logger) *k8sResourceDeleter {
	return &k8sResourceDeleter{
		namespacer: request.GetNamespaceMapper(cfg),
		restConfig: restCfg,
		log:        logger,
		gvrs:       migratedResourceGVRs(),
	}
}

// migratedResourceGVRs returns the list of GVRs for resources that may have
// been migrated to unified storage and need deletion during org cleanup.
func migratedResourceGVRs() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		playlistv1.PlaylistKind().GroupVersionResource(),
	}
}

// deleteCollections deletes all resources for each migrated GVR in the given org.
// Errors indicating a missing or unregistered resource (NotFound, MethodNotSupported)
// are logged as warnings and do not block org deletion. All other errors are
// propagated so that the caller fails visibly when resources cannot be cleaned up.
func (d *k8sResourceDeleter) deleteCollections(ctx context.Context, orgID int64) error {
	cfg, err := d.restConfig.GetRestConfig(ctx)
	if err != nil {
		return fmt.Errorf("get rest config: %w", err)
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return fmt.Errorf("create dynamic client: %w", err)
	}

	ns := d.namespacer(orgID)

	for _, gvr := range d.gvrs {
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
