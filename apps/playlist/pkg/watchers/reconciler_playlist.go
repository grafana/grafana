package watchers

import (
	"context"
	"errors"
	"fmt"

	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	playlist "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
)

func NewPlaylistReconciler() operator.Reconciler {
	inner := simple.Reconciler{}

	inner.ReconcileFunc = func(ctx context.Context, request operator.ReconcileRequest) (operator.ReconcileResult, error) {
		switch request.Action {
		case operator.ReconcileActionCreated:
			pObj, err := assertType(request.Object)
			if err == nil {
				klog.InfoS("Added resource", "name", pObj.GetStaticMetadata().Identifier().Name)
			}
			return operator.ReconcileResult{}, err
		case operator.ReconcileActionUpdated:
			pObj, err := assertType(request.Object)
			if err == nil {
				klog.InfoS("Updated resource", "name", pObj.GetStaticMetadata().Identifier().Name)
			}
			return operator.ReconcileResult{}, err
		case operator.ReconcileActionDeleted:
			pObj, err := assertType(request.Object)
			if err == nil {
				klog.InfoS("Deleted resource", "name", pObj.GetStaticMetadata().Identifier().Name)
			}
			return operator.ReconcileResult{}, err
		case operator.ReconcileActionResynced:
			pObj, err := assertType(request.Object)
			if err == nil {
				klog.InfoS("Possibly updated resource", "name", pObj.GetStaticMetadata().Identifier().Name)
			}
			return operator.ReconcileResult{}, err
		case operator.ReconcileActionUnknown:
			return operator.ReconcileResult{}, errors.New("Invalid reconcile action unknown")
		}
		return operator.ReconcileResult{}, errors.New("Invalid reconcile action")
	}

	return &operator.OpinionatedReconciler{Reconciler: &inner}
}

func assertType(obj resource.Object) (*playlist.Playlist, error) {
	object, ok := obj.(*playlist.Playlist)
	if !ok {
		return nil, fmt.Errorf("provided object is not of type *playlist.Playlist (name=%s, namespace=%s, kind=%s)",
			obj.GetStaticMetadata().Name, obj.GetStaticMetadata().Namespace, obj.GetStaticMetadata().Kind)
	}
	return object, nil
}
