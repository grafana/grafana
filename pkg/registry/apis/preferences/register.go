package preferences

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

var (
	_ builder.APIGroupBuilder    = (*APIBuilder)(nil)
	_ builder.APIGroupValidation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer  authorizer.Authorizer
	legacyPrefs grafanarest.Storage

	merger *merger // joins all preferences
}

func RegisterAPIService(
	cfg *setting.Cfg,
	db db.DB,
	prefs pref.Service,
	accessClient authlib.AccessClient,
	apiregistration builder.APIRegistrar,
	_ resource.ClientGenerator,
) (*APIBuilder, error) {
	sql := legacy.NewLegacySQL(legacysql.NewDatabaseProvider(db))
	builder := &APIBuilder{
		merger: newMerger(cfg),
		authorizer: &utils.AuthorizeFromName{
			OKNames:      []string{"merged"},
			AccessClient: accessClient, // can i edit a team
			Resource: map[string][]utils.ResourceOwner{
				"preferences": {
					utils.NamespaceResourceOwner,
					utils.TeamResourceOwner,
					utils.UserResourceOwner,
				},
			},
		},
	}

	namespacer := request.GetNamespaceMapper(cfg)
	if prefs != nil {
		builder.legacyPrefs = legacy.NewPreferencesStorage(prefs, namespacer, sql)
	}
	apiregistration.RegisterAPI(builder)
	return builder, nil
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

	// Required for patch (hub version)
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	},
		&preferences.Preferences{},
		&preferences.PreferencesList{},
	)

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	prefs := preferences.PreferencesResourceInfo

	var store grafanarest.Storage
	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, prefs, opts.OptsGetter)
	if err != nil {
		return err
	}
	if b.legacyPrefs != nil && opts.DualWriteBuilder != nil {
		store, err = opts.DualWriteBuilder(prefs.GroupResource(), b.legacyPrefs, store)
		if err != nil {
			return err
		}
	}
	wrappedStorage := &preferencesStorage{store}
	storage[prefs.StoragePath()] = wrappedStorage
	b.merger.lister = wrappedStorage

	apiGroupInfo.VersionedResourcesStorageMap[preferences.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return preferences.GetOpenAPIDefinitions
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	return b.merger.GetAPIRoutes(defs)
}
