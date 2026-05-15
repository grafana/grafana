package palettes

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"
	palettesapi "github.com/grafana/grafana/apps/palettes/pkg/apis/palettes/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ builder.APIGroupBuilder    = (*APIBuilder)(nil)
	_ builder.APIGroupValidation = (*APIBuilder)(nil)
)

type APIBuilder struct {
	authorizer authorizer.Authorizer
}

func RegisterAPIService(
	_ *setting.Cfg,
	accessClient authlib.AccessClient,
	apiregistration builder.APIRegistrar,
) *APIBuilder {
	b := &APIBuilder{
		authorizer: NewPaletteAuthorizer(&prefutils.AuthorizeFromName{
			AccessClient: accessClient,
			Resource: map[string][]prefutils.ResourceOwner{
				Resource: {
					prefutils.NamespaceResourceOwner,
					prefutils.UserResourceOwner,
					prefutils.TeamResourceOwner,
				},
			},
		}),
	}

	apiregistration.RegisterAPI(b)
	return b
}

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return palettesapi.GroupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := palettesapi.GroupVersion
	if err := palettesapi.AddToScheme(scheme); err != nil {
		return err
	}

	// Required for patch (hub version).
	scheme.AddKnownTypes(schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	},
		&palettesapi.Palette{},
		&palettesapi.PaletteList{},
	)

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}
	resource := palettesapi.PalettesResourceInfo

	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resource, opts.OptsGetter)
	if err != nil {
		return err
	}

	storage[resource.StoragePath()] = &paletteStorage{Storage: store}
	apiGroupInfo.VersionedResourcesStorageMap[palettesapi.APIVersion] = storage
	return nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.authorizer
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
}

func (b *APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return AdmissionValidate(ctx, a, o)
}
