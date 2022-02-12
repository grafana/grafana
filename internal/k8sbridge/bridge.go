// Package k8sbridge provides interfaces for communicating with an underlying
// Kubernetes apiserver

package k8sbridge

import (
	"github.com/grafana/grafana/pkg/schema"
	"k8s.io/apimachinery/pkg/runtime"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/scheme"
)

var (
	groupName    = "grafana.core.group"
	// TODO come up with rule governing when and why this is incremented
	groupVersion = "v1alpha1"
)

// Should we write some simple watcher / interface consumer so that we can test if our interface works?

// TODO figure out whether we take a *rest.Config in this provider, which implies
// that something else will turn grafana.ini config into a *rest.Config, OR if we take
// raw config in this provider and make the *rest.Config ourselves
// ALso depends on outcome of deciding what our config will be https://github.com/grafana/grafana/issues/44291
func ProvideAPIServerClient(cfg *rest.Config) (*rest.RESTClient, error) {
	return rest.RESTClientFor(cfg)
}

// TODO: May rename to just ProvideService if we are sure the package will only have one service.
func ProvideBridgeService(cfg *rest.Config, list schema.CoreSchemaList) (*Bridge, error) {
	c, err := rest.RESTClientFor(cfg)
	if err != nil {
		return nil, err
	}

	schm := runtime.NewScheme()
	schemaGroupVersion := k8schema.GroupVersion{Group: groupName, Version: groupVersion}
	schemaBuilder := &scheme.Builder{GroupVersion: schemaGroupVersion}

	utilruntime.Must(schemaBuilder.AddToScheme(schm))
	for _, cr := range list {
		schemaBuilder.Register(cr.GetRuntimeObjects()...)
	}

	mgropts := ctrl.Options{
		Scheme: schm,
	}

	mgr, err := ctrl.NewManager(cfg, mgropts)
	if err != nil {
		return nil, err
	}

	b := &Bridge{
		Client:  c,
		Schemas: list,
		Manager: mgr,
	}

	/*
		go func() {
			if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
				panic(err)
			}
		}()
	*/

	return b, nil
}

type Bridge struct {
	Client  *rest.RESTClient
	Schemas schema.CoreSchemaList
	Manager ctrl.Manager
}
