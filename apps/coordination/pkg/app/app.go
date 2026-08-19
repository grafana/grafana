package app

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

// New creates the coordination app. The app serves two kinds sharing one spec: a
// namespaced Lease (tenant-scoped coordination) and a cluster-scoped GlobalLease
// (fleet coordination owned by no tenant). A lease is a dumb record and all election
// logic lives client-side, so the app only enforces admission policy (see
// validation.go) and — when enabled — runs the lease garbage collector (see gc.go),
// which watches both kinds and deletes leases abandoned past a grace period.
// Read/write authorization for the cluster-scoped GlobalLease is enforced by the
// storage authorizer wired in the registry installer, while the namespaced Lease
// relies on ordinary namespace authz.
func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "apis"

	reconciler, gcRunnable, err := newGarbageCollector(cfg)
	if err != nil {
		return nil, err
	}

	leaseKind := simple.AppManagedKind{
		Kind:      coordinationv0alpha1.LeaseKind(),
		Validator: &simple.Validator{ValidateFunc: validateLease},
	}
	globalLeaseKind := simple.AppManagedKind{
		Kind:      coordinationv0alpha1.GlobalLeaseKind(),
		Validator: &simple.Validator{ValidateFunc: validateGlobalLease},
	}
	if reconciler != nil {
		// UsePlain avoids the OpinionatedReconciler's finalizer management: GC deletes
		// leases outright, so it must not add finalizers that would block deletion.
		leaseKind.Reconciler = reconciler
		leaseKind.ReconcileOptions = simple.BasicReconcileOptions{UsePlain: true}
		globalLeaseKind.Reconciler = reconciler
		globalLeaseKind.ReconcileOptions = simple.BasicReconcileOptions{UsePlain: true}
	}

	simpleConfig := simple.AppConfig{
		Name:       "coordination",
		KubeConfig: cfg.KubeConfig,
		InformerConfig: simple.AppInformerConfig{
			InformerOptions: operator.InformerOptions{
				ErrorHandler: func(ctx context.Context, err error) {
					klog.ErrorS(err, "Informer processing error")
				},
			},
		},
		ManagedKinds: []simple.AppManagedKind{leaseKind, globalLeaseKind},
	}

	a, err := simple.NewApp(simpleConfig)
	if err != nil {
		return nil, err
	}

	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}

	// The GC runnable runs the leader election that gates the reconciler's deletions.
	if gcRunnable != nil {
		a.AddRunnable(gcRunnable)
	}

	return a, nil
}

// GetKinds returns the kinds served by the coordination app, keyed by GroupVersion.
func GetKinds() map[schema.GroupVersion][]resource.Kind {
	gv := schema.GroupVersion{
		Group:   coordinationv0alpha1.LeaseKind().Group(),
		Version: coordinationv0alpha1.LeaseKind().Version(),
	}
	return map[schema.GroupVersion][]resource.Kind{
		gv: {coordinationv0alpha1.LeaseKind(), coordinationv0alpha1.GlobalLeaseKind()},
	}
}
