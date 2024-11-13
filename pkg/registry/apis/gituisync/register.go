package gituisync

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apis/gituisync/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var _ builder.APIGroupBuilder = (*GitUISyncAPIBuilder)(nil)

// This is used just so wire has something unique to return
type GitUISyncAPIBuilder struct{}

func NewGitUISyncAPIBuilder() *GitUISyncAPIBuilder {
	return &GitUISyncAPIBuilder{}
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
) *GitUISyncAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewGitUISyncAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *GitUISyncAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *GitUISyncAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return v0alpha1.SchemeGroupVersion
}

func (b *GitUISyncAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := v0alpha1.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = v0alpha1.AddKnownTypes(v0alpha1.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only 1 version (for now?)
	return scheme.SetVersionPriority(v0alpha1.SchemeGroupVersion)
}

func (b *GitUISyncAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme
	optsGetter := opts.OptsGetter

	repositoryStorage, err := newRepositoryStorage(scheme, optsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}

	storage := map[string]rest.Storage{}
	storage[v0alpha1.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	apiGroupInfo.VersionedResourcesStorageMap[v0alpha1.VERSION] = storage
	return nil
}

func (b *GitUISyncAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

func (b *GitUISyncAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// TODO: Do we need any?
	return nil
}

func (b *GitUISyncAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana Git UI Sync"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	// TODO: we might want to register some extras for subresources here.

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	return oas, nil
}
