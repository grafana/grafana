package reconcilers

import (
	"context"

	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/operator"
	playlist "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
)

func NewPlaylistReconciler(patchClient operator.PatchClient) (operator.Reconciler, error) {
	inner := operator.TypedReconciler[*playlist.Playlist]{}

	inner.ReconcileFunc = func(ctx context.Context, request operator.TypedReconcileRequest[*playlist.Playlist]) (operator.ReconcileResult, error) {
		switch request.Action {
		case operator.ReconcileActionCreated:
			klog.InfoS("Added resource", "name", request.Object.GetStaticMetadata().Identifier().Name)
			return operator.ReconcileResult{}, nil
		case operator.ReconcileActionUpdated:
			klog.InfoS("Updated resource", "name", request.Object.GetStaticMetadata().Identifier().Name)
			return operator.ReconcileResult{}, nil
		case operator.ReconcileActionDeleted:
			klog.InfoS("Deleted resource", "name", request.Object.GetStaticMetadata().Identifier().Name)
			return operator.ReconcileResult{}, nil
		case operator.ReconcileActionResynced:
			klog.InfoS("Possibly updated resource", "name", request.Object.GetStaticMetadata().Identifier().Name)
			return operator.ReconcileResult{}, nil
		case operator.ReconcileActionUnknown:
			klog.InfoS("error reconciling unknown action for Playlist", "action", request.Action, "object", request.Object)
			return operator.ReconcileResult{}, nil
		}

		klog.InfoS("error reconciling invalid action for Playlist", "action", request.Action, "object", request.Object)
		return operator.ReconcileResult{}, nil
	}

	// prefixing the finalizer with <group>-<kind> similar to how OpinionatedWatcher does
	reconciler, err := operator.NewOpinionatedReconciler(patchClient, "playlist-playlists-finalizer")
	if err != nil {
		klog.ErrorS(err, "Error creating opinionated reconciler for playlists")
		return nil, err
	}
	reconciler.Reconciler = &inner
	return reconciler, nil
}
