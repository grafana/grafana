package snapshots

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	snapshots "github.com/grafana/grafana/pkg/apis/snapshots/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/setting"
)

// GroupName is the group name for this API.
const GroupName = "snapshots.grafana.app"
const VersionID = "v0alpha1"

var _ grafanaapiserver.APIGroupBuilder = (*SnapshotsAPIBuilder)(nil)

// This is used just so wire has something unique to return
type SnapshotsAPIBuilder struct {
	service    dashboardsnapshots.Service
	namespacer request.NamespaceMapper
	options    sharingOptionsGetter
	gv         schema.GroupVersion
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	p dashboardsnapshots.Service,
	apiregistration grafanaapiserver.APIRegistrar,
) *SnapshotsAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := &SnapshotsAPIBuilder{
		service:    p,
		options:    newSharingOptionsGetter(cfg),
		namespacer: request.GetNamespaceMapper(cfg),
		gv:         schema.GroupVersion{Group: GroupName, Version: VersionID},
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *SnapshotsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.gv
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&snapshots.DashboardSnapshot{},
		&snapshots.DashboardSnapshotList{},
		&snapshots.SharingOptions{},
		&snapshots.SharingOptionsList{},
		&metav1.Status{},
	)
}

func (b *SnapshotsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	addKnownTypes(scheme, b.gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   b.gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, b.gv)
	return scheme.SetVersionPriority(b.gv)
}

func (b *SnapshotsAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(GroupName, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service:                   b.service,
		namespacer:                b.namespacer,
		DefaultQualifiedResource:  b.gv.WithResource("dashboards").GroupResource(),
		SingularQualifiedResource: b.gv.WithResource("dashboard").GroupResource(),
	}
	legacyStore.tableConverter = utils.NewTableConverter(
		legacyStore.DefaultQualifiedResource,
		[]metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The snapshot name"},
			{Name: "Created At", Type: "date"},
		},
		func(obj any) ([]interface{}, error) {
			m, ok := obj.(*snapshots.DashboardSnapshot)
			if ok {
				return []interface{}{
					m.Name,
					m.Info.Title,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected snapshot")
		},
	)
	storage["dashboards"] = legacyStore
	storage["dashboards/delete"] = &DeleteKeyREST{
		service: b.service,
	}

	storage["options"] = &optionsStorage{
		getter:         b.options,
		tableConverter: legacyStore.tableConverter,
	}

	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *SnapshotsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return snapshots.GetOpenAPIDefinitions
}

func (b *SnapshotsAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil // no custom API routes
}
