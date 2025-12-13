package live

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ builder.APIGroupBuilder = (*APIBuilder)(nil)
)

type APIBuilder struct {
	namespacer authlib.NamespaceFormatter
	live       *live.GrafanaLive
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	live *live.GrafanaLive,
	apiregistration builder.APIRegistrar,
) *APIBuilder {
	// Requires development settings and clearly experimental
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil
	}

	builder := &APIBuilder{
		live:       live,
		namespacer: request.GetNamespaceMapper(cfg),
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

// AllowedV0Alpha1Resources implements builder.APIGroupBuilder.
func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return preferences.GroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := preferences.GroupVersion
	err := preferences.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	// prefs := preferences.PreferencesResourceInfo
	// storage[prefs.StoragePath()] = b.legacyPrefs

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}
