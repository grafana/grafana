package sso

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ssov0 "github.com/grafana/grafana/pkg/apis/sso/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

var _ builder.APIGroupBuilder = (*SSOSettingAPIBuilder)(nil)

type SSOSettingAPIBuilder struct {
	store *legacyStorage
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	// maybe create new storage?
	service ssosettings.Service,
) (*SSOSettingAPIBuilder, error) {
	// skip registration unless opting into experimental apis
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil
	}

	store := newLegacyStorage(service)

	builder := &SSOSettingAPIBuilder{
		store: store,
	}
	apiregistration.RegisterAPI(builder)

	return builder, nil
}

func (b *SSOSettingAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return ssov0.SchemeGroupVersion
}

func (b *SSOSettingAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	return ssov0.AddKnownTypes(ssov0.SchemeGroupVersion, scheme)
}

func (b *SSOSettingAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	dualWriteBuilder grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(ssov0.GROUP, scheme, metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}

	storage[ssov0.SSOSettingResourceInfo.StoragePath()] = b.store
	apiGroupInfo.VersionedResourcesStorageMap[ssov0.VERSION] = storage

	return &apiGroupInfo, nil
}

func (b *SSOSettingAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return ssov0.GetOpenAPIDefinitions
}

func (b *SSOSettingAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// no custom API routes
	return nil
}

func (b *SSOSettingAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "no identity found", err
			}
			if !user.GetIsGrafanaAdmin() {
				return authorizer.DecisionDeny, "only grafana admins have access for now", nil
			}
			return authorizer.DecisionAllow, "", nil
		},
	)
}
