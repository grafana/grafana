// Package root serves the datasource.grafana.app group itself, as opposed to
// the per-plugin {plugin}.datasource.grafana.app groups. It exists so callers
// can list every datasource connection in a namespace in one request.
package root

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apiruntime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/connections"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder       = (*RootAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider = (*RootAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor  = (*RootAPIBuilder)(nil)
)

type RootAPIBuilder struct {
	connections  datasourceV0.DataSourceConnectionProvider
	accessClient authlib.AccessClient
}

func NewRootAPIBuilder(store datasourceV0.DataSourceConnectionProvider, accessClient authlib.AccessClient) *RootAPIBuilder {
	return &RootAPIBuilder{connections: store, accessClient: accessClient}
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiRegistrar builder.APIRegistrar,
	sql legacysql.LegacyDatabaseProvider,
	accessClient authlib.AccessClient,
	pluginStore pluginstore.Store,
) (*RootAPIBuilder, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagDatasourceConnectionsAPI) {
		return nil, nil // skip registration unless explicitly enabled
	}

	aliases := func(ctx context.Context, pluginID string) []string {
		p, found := pluginStore.Plugin(ctx, pluginID)
		if !found {
			return nil
		}
		return p.AliasIDs
	}

	b := NewRootAPIBuilder(connections.NewLegacySQLStore(sql, accessClient, aliases), accessClient)
	apiRegistrar.RegisterAPI(b)
	return b, nil
}

func (b *RootAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return datasourceV0.SchemeGroupVersion
}

func (b *RootAPIBuilder) InstallSchema(scheme *apiruntime.Scheme) error {
	gv := b.GetGroupVersion()
	scheme.AddKnownTypes(gv,
		&datasourceV0.DataSourceConnectionList{},
		&datasourceV0.DataSourceConnectionQuery{},
	)
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *RootAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *RootAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	gv := b.GetGroupVersion()

	// k8s needs a real storage registered -- connections are handled directly
	// by the custom route below, so this one is hidden from the spec.
	apiGroupInfo.VersionedResourcesStorageMap[gv.Version] = map[string]rest.Storage{
		"noop": &noopREST{},
	}
	return nil
}

func (b *RootAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return datasourceV0.GetOpenAPIDefinitions
}

func (b *RootAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return &builder.APIRoutes{
		Namespace: connections.Routes(b.connections, defs),
	}
}

// GetAuthorizer gates the namespace before the store filters the list down to
// the datasources the caller may actually read.
func (b *RootAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	group := b.GetGroupVersion().Group
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			if b.accessClient == nil {
				return authorizer.DecisionAllow, "", nil
			}

			rsp, err := b.accessClient.Check(ctx, user, authlib.CheckRequest{
				Group:     group,
				Resource:  attr.GetResource(),
				Namespace: attr.GetNamespace(),
				Name:      attr.GetName(),
				Verb:      attr.GetVerb(),
			}, "")
			if err != nil {
				return authorizer.DecisionDeny, "failed to check permissions", err
			}
			if !rsp.Allowed {
				return authorizer.DecisionDeny, "access denied", nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}

func (b *RootAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Datasource connections"

	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Remove the noop path -- it was only required to make k8s behave normally
	delete(oas.Paths.Paths, root+"noop/{name}")

	return oas, nil
}
