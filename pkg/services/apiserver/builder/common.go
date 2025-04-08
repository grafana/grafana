package builder

import (
	"context"
	"fmt"
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// TODO: this (or something like it) belongs in grafana-app-sdk,
// but lets keep it here while we iterate on a few simple examples
type APIGroupBuilder interface {
	// Add the kinds to the server scheme
	InstallSchema(scheme *runtime.Scheme) error

	// UpdateAPIGroupInfo used to be a getter until we ran into the issue
	// where separate API Group Info for the same group (different versions) aren't handled well by
	// the InstallAPIGroup facility of genericapiserver. Also, we can only ever call InstallAPIGroup
	// once on the genericapiserver per group, or we run into double registration startup errors.
	//
	// The caller should share the apiGroupInfo passed into this function across builder versions of the same group.
	// UpdateAPIGroupInfo builds the group+version behavior updating the passed in apiGroupInfo in place
	UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts APIGroupOptions) error

	// Get OpenAPI definitions
	GetOpenAPIDefinitions() common.GetOpenAPIDefinitions
}

type APIGroupVersionProvider interface {
	GetGroupVersion() schema.GroupVersion
}

type APIGroupVersionsProvider interface {
	GetGroupVersions() []schema.GroupVersion
}

type APIGroupAuthorizer interface {
	GetAuthorizer() authorizer.Authorizer
}

type APIGroupMutation interface {
	// Mutate allows the builder to make changes to the object before it is persisted.
	// Context is used only for timeout/deadline/cancellation and tracing information.
	Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error)
}

type APIGroupValidation interface {
	// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate
	// Context is used only for timeout/deadline/cancellation and tracing information.
	Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error)
}

type APIGroupRouteProvider interface {
	// Support direct HTTP routes from an APIGroup
	GetAPIRoutes(gv schema.GroupVersion) *APIRoutes
}

type APIGroupPostStartHookProvider interface {
	// GetPostStartHooks returns a list of functions that will be called after the server has started
	GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error)
}

type APIGroupOptions struct {
	Scheme              *runtime.Scheme
	OptsGetter          generic.RESTOptionsGetter
	DualWriteBuilder    grafanarest.DualWriteBuilder
	MetricsRegister     prometheus.Registerer
	StorageOptsRegister apistore.StorageOptionsRegister
	StorageOpts         *options.StorageOptions
}

// Builders that implement OpenAPIPostProcessor are given a chance to modify the schema directly
type OpenAPIPostProcessor interface {
	PostProcessOpenAPI(*spec3.OpenAPI) (*spec3.OpenAPI, error)
}

// This is used to implement dynamic sub-resources like pods/x/logs
type APIRouteHandler struct {
	Path    string           // added to the appropriate level
	Spec    *spec3.PathProps // Exposed in the open api service discovery
	Handler http.HandlerFunc // when Level = resource, the resource will be available in context
}

// APIRoutes define explicit HTTP handlers in an apiserver
// TBD: is this actually necessary -- there may be more k8s native options for this
type APIRoutes struct {
	// Root handlers are registered directly after the apiVersion identifier
	Root []APIRouteHandler

	// Namespace handlers are mounted under the namespace
	Namespace []APIRouteHandler
}

type APIRegistrar interface {
	RegisterAPI(builder APIGroupBuilder)
}

func getGroup(builder APIGroupBuilder) (string, error) {
	if v, ok := builder.(APIGroupVersionProvider); ok {
		return v.GetGroupVersion().Group, nil
	}

	if v, ok := builder.(APIGroupVersionsProvider); ok {
		if len(v.GetGroupVersions()) == 0 {
			return "", fmt.Errorf("unable to get group: builder returned no versions")
		}

		return v.GetGroupVersions()[0].Group, nil
	}

	return "", fmt.Errorf("unable to get group: builder does not implement APIGroupVersionProvider or APIGroupVersionsProvider")
}

func GetGroupVersions(builder APIGroupBuilder) []schema.GroupVersion {
	if v, ok := builder.(APIGroupVersionProvider); ok {
		return []schema.GroupVersion{v.GetGroupVersion()}
	}

	if v, ok := builder.(APIGroupVersionsProvider); ok {
		return v.GetGroupVersions()
	}

	// this should never happen
	panic("builder does not implement APIGroupVersionProvider or APIGroupVersionsProvider")
}
