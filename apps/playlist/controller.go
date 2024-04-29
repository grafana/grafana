package playlist

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/apis/playlist/v0alpha1"
	"k8s.io/client-go/rest"
	"k8s.io/klog/v2"
)

// example of a manually created controller
func NewController(restConfig *rest.Config) (*operator.InformerController, error) {
	clientRegistry := k8s.NewClientRegistry(*restConfig, k8s.DefaultClientConfig())
	controller := operator.NewInformerController(operator.DefaultInformerControllerConfig())
	kind := playlistv0alpha1.PlaylistKind()
	kindStr := fmt.Sprintf("%s.%s/%s", kind.Plural(), kind.Group(), kind.Version())
	err := controller.AddReconciler(reconcileFunc(reconcile), kindStr)
	if err != nil {
		return nil, fmt.Errorf("error adding reconciler for %s: %w", kindStr, err)
	}
	client, err := clientRegistry.ClientFor(kind)
	if err != nil {
		return nil, fmt.Errorf("error creating kubernetes client for %s: %w", kindStr, err)
	}
	informer, err := operator.NewKubernetesBasedInformer(kind, client, resource.NamespaceAll)
	if err != nil {
		return nil, fmt.Errorf("error creating informer for %s: %w", kindStr, err)
	}
	err = controller.AddInformer(informer, kindStr)
	if err != nil {
		return nil, fmt.Errorf("error adding informer for %s to controller: %w", kindStr, err)
	}
	return controller, nil
}

func reconcile(ctx context.Context, request operator.ReconcileRequest) (operator.ReconcileResult, error) {
	klog.Infof("Received %s event for %s\n", operator.ResourceActionFromReconcileAction(request.Action), request.Object.GetName())
	cast, ok := request.Object.(*playlistv0alpha1.Playlist)
	if !ok {
		return operator.ReconcileResult{}, fmt.Errorf("reconcile object is not a Playlist(gvk=%s)", request.Object.GroupVersionKind().String())
	}
	klog.Infof("ResourceVersion: %s, Title: %s\n", cast.GetResourceVersion(), cast.Spec.Title)
	return operator.ReconcileResult{}, nil
}

type reconcileFunc func(ctx context.Context, request operator.ReconcileRequest) (operator.ReconcileResult, error)

func (r reconcileFunc) Reconcile(ctx context.Context, request operator.ReconcileRequest) (operator.ReconcileResult, error) {
	return r(ctx, request)
}
