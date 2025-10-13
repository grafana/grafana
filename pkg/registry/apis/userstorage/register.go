package userstorage

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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	userstorage "github.com/grafana/grafana/pkg/apis/userstorage/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*UserStorageAPIBuilder)(nil)

type UserStorageAPIBuilder struct {
	registerer prometheus.Registerer
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar, registerer prometheus.Registerer) *UserStorageAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagUserStorageAPI) {
		return nil
	}

	builder := &UserStorageAPIBuilder{
		registerer: registerer,
	}
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *UserStorageAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return userstorage.SchemeGroupVersion
}

func (b *UserStorageAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := userstorage.SchemeGroupVersion
	err := userstorage.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	// addKnownTypes(scheme, schema.GroupVersion{
	// 	Group:   userstorage.GROUP,
	// 	Version: runtime.APIVersionInternal,
	// })
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *UserStorageAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := userstorage.UserStorageResourceInfo
	storage := map[string]rest.Storage{}

	storageReg, err := newStorage(opts.Scheme, opts.OptsGetter, b.registerer)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()] = storageReg

	apiGroupInfo.VersionedResourcesStorageMap[userstorage.VERSION] = storage
	return nil
}

func (b *UserStorageAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return userstorage.GetOpenAPIDefinitions
}

func (b *UserStorageAPIBuilder) GetAuthorizer() authorizer.Authorizer {
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

			switch attr.GetVerb() {
			case "create":
				// Create requests are validated later since we don't have access to the resource name
				return authorizer.DecisionNoOpinion, "", nil
			case "get", "delete", "patch", "update":
				// Only allow the user to access their own settings
				if !compareResourceNameAndUserUID(attr.GetName(), u) {
					return authorizer.DecisionDeny, "forbidden", nil
				}
				return authorizer.DecisionAllow, "", nil
			default:
				// Forbid the rest
				return authorizer.DecisionDeny, "forbidden", nil
			}
		})
}
