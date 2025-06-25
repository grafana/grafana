package preferences

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*PreferencesAPIBuilder)(nil)

type PreferencesAPIBuilder struct {
	registerer prometheus.Registerer
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar, registerer prometheus.Registerer) *PreferencesAPIBuilder {
	builder := &PreferencesAPIBuilder{
		registerer: registerer,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

// AllowedV0Alpha1Resources implements builder.APIGroupBuilder.
func (b *PreferencesAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *PreferencesAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return preferences.GroupVersion
}

func (b *PreferencesAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := preferences.GroupVersion
	err := preferences.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *PreferencesAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := preferences.PreferencesResourceInfo
	storage := map[string]rest.Storage{}

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()] = store

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *PreferencesAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}

func (b *PreferencesAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// require a user
			u, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// check if is admin
			if u.GetIsGrafanaAdmin() {
				return authorizer.DecisionAllow, "", nil
			}

			return authorizer.DecisionNoOpinion, "", nil
		})
}
