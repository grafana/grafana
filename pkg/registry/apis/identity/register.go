package identity

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	identity "github.com/grafana/grafana/pkg/apis/identity/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/team"
)

var _ builder.APIGroupBuilder = (*IdentityAPIBuilder)(nil)

// This is used just so wire has something unique to return
type IdentityAPIBuilder struct {
	service team.Service
}

func RegisterAPIService(svc team.Service,
	apiregistration builder.APIRegistrar,
) *IdentityAPIBuilder {
	builder := &IdentityAPIBuilder{
		service: svc,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *IdentityAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return identity.SchemeGroupVersion
}

func (b *IdentityAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	identity.AddKnownTypes(scheme, identity.VERSION)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	identity.AddKnownTypes(scheme, runtime.APIVersionInternal)

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, identity.SchemeGroupVersion)
	return scheme.SetVersionPriority(identity.SchemeGroupVersion)
}

func (b *IdentityAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	team := identity.TeamResourceInfo
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(identity.GROUP, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service: b.service,
		tableConverter: gapiutil.NewTableConverter(
			team.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The team name"},
				{Name: "Email", Type: "string", Format: "string", Description: "team email"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*identity.Team)
				if !ok {
					return nil, fmt.Errorf("expected playlist")
				}
				return []interface{}{
					m.Name,
					m.Spec.Title,
					m.Spec.Email,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
	}
	storage[team.StoragePath()] = legacyStore

	apiGroupInfo.VersionedResourcesStorageMap[identity.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *IdentityAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return identity.GetOpenAPIDefinitions
}

func (b *IdentityAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil // no custom API routes
}

func (b *IdentityAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}
