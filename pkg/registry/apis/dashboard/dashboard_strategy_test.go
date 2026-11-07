package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	dashinternal "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	apiserverbuilder "github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/restoptions"
)

func TestDashboardUpdateStrategyDropsConversionStatus(t *testing.T) {
	tests := []struct {
		name       string
		obj        runtime.Object
		old        runtime.Object
		conversion func(runtime.Object) any
	}{
		{
			name: "v0alpha1",
			obj: &dashv0.Dashboard{Status: dashv0.DashboardStatus{
				Conversion: &dashv0.DashboardConversionStatus{StoredVersion: new(dashv1.VERSION), Failed: true},
			}},
			old: &dashv0.Dashboard{Status: dashv0.DashboardStatus{
				Conversion: &dashv0.DashboardConversionStatus{StoredVersion: new(dashv1.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv0.Dashboard).Status.Conversion },
		},
		{
			name: "v1beta1",
			obj:  &dashv1beta1.Dashboard{},
			old: &dashv1beta1.Dashboard{Status: dashv1beta1.DashboardStatus{
				Conversion: &dashv1beta1.DashboardConversionStatus{StoredVersion: new(dashv2.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv1beta1.Dashboard).Status.Conversion },
		},
		{
			name: "v1",
			obj:  &dashv1.Dashboard{},
			old: &dashv1.Dashboard{Status: dashv1.DashboardStatus{
				Conversion: &dashv1.DashboardConversionStatus{StoredVersion: new(dashv2.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv1.Dashboard).Status.Conversion },
		},
		{
			name: "v2alpha1",
			obj:  &dashv2alpha1.Dashboard{},
			old: &dashv2alpha1.Dashboard{Status: dashv2alpha1.DashboardStatus{
				Conversion: &dashv2alpha1.DashboardConversionStatus{StoredVersion: new(dashv1.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv2alpha1.Dashboard).Status.Conversion },
		},
		{
			name: "v2beta1",
			obj:  &dashv2beta1.Dashboard{},
			old: &dashv2beta1.Dashboard{Status: dashv2beta1.DashboardStatus{
				Conversion: &dashv2beta1.DashboardConversionStatus{StoredVersion: new(dashv1.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv2beta1.Dashboard).Status.Conversion },
		},
		{
			name: "v2 after a read converted from v1",
			obj:  &dashv2.Dashboard{},
			old: &dashv2.Dashboard{Status: dashv2.DashboardStatus{
				Conversion: &dashv2.DashboardConversionStatus{StoredVersion: new(dashv1.VERSION)},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv2.Dashboard).Status.Conversion },
		},
		{
			name: "v2 after a failed read conversion",
			obj:  &dashv2.Dashboard{},
			old: &dashv2.Dashboard{Status: dashv2.DashboardStatus{
				Conversion: &dashv2.DashboardConversionStatus{
					StoredVersion: new(dashv1.VERSION),
					Failed:        true,
					Error:         new("conversion failed"),
					Source:        map[string]any{"title": "old"},
				},
			}},
			conversion: func(o runtime.Object) any { return o.(*dashv2.Dashboard).Status.Conversion },
		},
	}

	strategy := dashboardUpdateStrategy{
		RESTUpdateStrategy: grafanaregistry.NewStrategy(runtime.NewScheme(), dashv2.DashboardResourceInfo.GroupVersion()),
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			strategy.PrepareForUpdate(context.Background(), tt.obj, tt.old)

			require.Nil(t, tt.conversion(tt.obj), "a read-time conversion status must not be persisted")
			require.NotNil(t, tt.conversion(tt.old), "the existing object must not be modified")
		})
	}
}

func TestDashboardStorageUsesDashboardUpdateStrategy(t *testing.T) {
	scheme := runtime.NewScheme()
	require.NoError(t, dashv0.AddToScheme(scheme))
	require.NoError(t, dashv1beta1.AddToScheme(scheme))
	require.NoError(t, dashv1.AddToScheme(scheme))
	require.NoError(t, dashv2alpha1.AddToScheme(scheme))
	require.NoError(t, dashv2beta1.AddToScheme(scheme))
	require.NoError(t, dashv2.AddToScheme(scheme))
	codecs := serializer.NewCodecFactory(scheme)

	for _, info := range []utils.ResourceInfo{
		dashv0.DashboardResourceInfo,
		dashv1beta1.DashboardResourceInfo,
		dashv1.DashboardResourceInfo,
		dashv2alpha1.DashboardResourceInfo,
		dashv2beta1.DashboardResourceInfo,
		dashv2.DashboardResourceInfo,
	} {
		t.Run(info.GroupVersion().Version, func(t *testing.T) {
			optsGetter, err := restoptions.NewRESTOptionsGetterMemory(storagebackend.Config{
				Codec: codecs.LegacyCodec(info.GroupVersion()),
			}, nil)
			require.NoError(t, err)

			builder := &DashboardsAPIBuilder{
				iamFeatures: iamapi.Features{ResourcePermissionsAPI: true},
			}
			groupInfo := &genericapiserver.APIGroupInfo{
				VersionedResourcesStorageMap: map[string]map[string]rest.Storage{},
			}
			require.NoError(t, builder.storageForVersion(
				groupInfo,
				apiserverbuilder.APIGroupOptions{Scheme: scheme, OptsGetter: optsGetter},
				info,
				nil,
				nil,
				func(runtime.Object, *dashinternal.DashboardAccess) (runtime.Object, error) {
					return nil, nil
				},
			))

			installed := groupInfo.VersionedResourcesStorageMap[info.GroupVersion().Version][info.StoragePath()]
			wrapper, ok := installed.(dashboardStorageWrapper)
			require.True(t, ok, "expected dashboard storage wrapper, got %T", installed)
			store, ok := wrapper.Storage.(*registry.Store)
			require.True(t, ok, "expected registry store, got %T", wrapper.Storage)
			require.IsType(t, dashboardUpdateStrategy{}, store.UpdateStrategy)
		})
	}
}
