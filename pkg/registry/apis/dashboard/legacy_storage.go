package dashboard

import (
	"context"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/dashboard/v1alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type DashboardStorage struct {
	Resource       utils.ResourceInfo
	Access         legacy.DashboardAccess
	TableConverter rest.TableConvertor

	Server   resource.ResourceServer
	Features featuremgmt.FeatureToggles
}

func (s *DashboardStorage) NewStore(scheme *runtime.Scheme, defaultOptsGetter generic.RESTOptionsGetter, reg prometheus.Registerer) (grafanarest.LegacyStorage, error) {
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: s.Access,
		Reg:     reg,
	})
	if err != nil {
		return nil, err
	}
	s.Server = server

	resourceInfo := s.Resource
	defaultOpts, err := defaultOptsGetter.GetRESTOptions(resourceInfo.GroupResource(), nil)
	if err != nil {
		return nil, err
	}
	client := resource.NewDirectResourceClient(server) // same context
	optsGetter := apistore.NewRESTOptionsGetterForClient(client,
		defaultOpts.StorageConfig.Config,
	)

	store, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
	return &storeWrapper{
		Store: store,
	}, err
}

type storeWrapper struct {
	*registry.Store
}

// Create will create the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	ctx = legacy.WithLegacyAccess(ctx)
	obj, err := s.Store.Create(ctx, obj, createValidation, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.Dashboard != nil {
		id, ok, _ := unstructured.NestedInt64(access.Dashboard.Spec.Object, "id")
		if ok {
			err = setInternalID(obj, id)
		}
	}
	return obj, err
}

// Update will update the dashboard using legacy storage and make sure the internal ID is set on the return object
func (s *storeWrapper) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	ctx = legacy.WithLegacyAccess(ctx)
	obj, created, err := s.Store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	access := legacy.GetLegacyAccess(ctx)
	if access != nil && access.Dashboard != nil {
		id, ok, _ := unstructured.NestedInt64(access.Dashboard.Spec.Object, "id")
		if ok {
			err = setInternalID(obj, id)
		}
	}
	return obj, created, err
}

func setInternalID(obj runtime.Object, id int64) error {
	d0, ok := obj.(*v0alpha1.Dashboard)
	if ok {
		d0.Spec.Object["id"] = id
		return nil
	}

	d1, ok := obj.(*v1alpha1.Dashboard)
	if ok {
		d1.Spec.Object["id"] = id
		return nil
	}

	return fmt.Errorf("unable to set internal ID (unsupported type: %T)", obj)
}
