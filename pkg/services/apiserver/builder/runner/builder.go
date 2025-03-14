package runner

import (
	"fmt"
	"io"
	"net/http"
	"path"

	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ AppBuilder = (*appBuilder)(nil)

type LegacyStorageGetter func(schema.GroupVersionResource) grafanarest.Storage

type AppBuilderConfig struct {
	Authorizer          authorizer.Authorizer
	LegacyStorageGetter LegacyStorageGetter
	OpenAPIDefGetter    common.GetOpenAPIDefinitions
	ManagedKinds        map[schema.GroupVersion][]resource.Kind
	CustomConfig        any

	groupVersion schema.GroupVersion
}

type AppBuilder interface {
	builder.APIGroupBuilder
	builder.APIGroupMutation
	builder.APIGroupValidation
	SetApp(app app.App)
}

type appBuilder struct {
	app    app.App
	config AppBuilderConfig
	logger log.Logger
}

func NewAppBuilder(appBuilderConfig AppBuilderConfig) (*appBuilder, error) {
	return &appBuilder{
		config: appBuilderConfig,
		logger: log.New("builder.runner.app"),
	}, nil
}

func (b *appBuilder) SetApp(app app.App) {
	b.app = app
}

// GetGroupVersion implements APIGroupBuilder.GetGroupVersion
func (b *appBuilder) GetGroupVersion() schema.GroupVersion {
	return b.config.groupVersion
}

// InstallSchema implements APIGroupBuilder.InstallSchema
func (b *appBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()), kind.ZeroValue())
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()+"List"), kind.ZeroListValue())

			// Link this group to the internal representation.
			// This is used for server-side-apply (PATCH), and avoids the error:
			// "no kind is registered for the type"
			gvInternal := schema.GroupVersion{
				Group:   gv.Group,
				Version: runtime.APIVersionInternal,
			}
			scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()), kind.ZeroValue())
			scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()+"List"), kind.ZeroListValue())
		}
	}
	return scheme.SetVersionPriority(gv)
}

// UpdateAPIGroupInfo implements APIGroupBuilder.UpdateAPIGroupInfo
func (b *appBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
			version := kind.GroupVersionKind().Version
			if _, ok := apiGroupInfo.VersionedResourcesStorageMap[version]; !ok {
				apiGroupInfo.VersionedResourcesStorageMap[version] = make(map[string]rest.Storage)
			}
			resourceInfo := KindToResourceInfo(kind)
			store, err := b.getStorage(resourceInfo, opts)
			if err != nil {
				return err
			}
			apiGroupInfo.VersionedResourcesStorageMap[version][resourceInfo.StoragePath()] = store
		}
	}
	return nil
}

func (b *appBuilder) getStorage(resourceInfo utils.ResourceInfo, opts builder.APIGroupOptions) (grafanarest.Storage, error) {
	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return nil, err
	}
	if b.config.LegacyStorageGetter != nil && opts.DualWriteBuilder != nil {
		if legacyStorage := b.config.LegacyStorageGetter(resourceInfo.GroupVersionResource()); legacyStorage != nil {
			return opts.DualWriteBuilder(resourceInfo.GroupResource(), legacyStorage, store)
		}
	}
	return store, nil
}

// GetOpenAPIDefinitions implements APIGroupBuilder.GetOpenAPIDefinitions
func (b *appBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return b.config.OpenAPIDefGetter
}

// GetAuthorizer implements APIGroupBuilder.GetAuthorizer
func (b *appBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.config.Authorizer
}

// GetAPIRoutes implements APIGroupRouteProvider interface
func (b *appBuilder) GetAPIRoutes() *builder.APIRoutes {
	routes := &builder.APIRoutes{
		Root:      make([]builder.APIRouteHandler, 0),
		Namespace: make([]builder.APIRouteHandler, 0),
	}

	for id, cr := range b.app.CustomRoutes() {
		routes.Namespace = append(routes.Namespace, builder.APIRouteHandler{
			Path: path.Join(id.ResourceIdentifier.Plural, id.SubresourcePath),
			Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				ctx, span := tracing.Start(r.Context(), "CustomRoute",
					semconv.HTTPMethodKey.String(r.Method),
					semconv.HTTPURLKey.String(r.URL.String()),
				)
				defer span.End()

				r = r.WithContext(ctx)

				ctxLog := b.logger.FromContext(r.Context())

				// Copy the resource identifier from the custom route
				resourceID := id.ResourceIdentifier

				// Get request info
				requestInfoFactory := &request.RequestInfoFactory{
					APIPrefixes:          sets.NewString("api", "apis"),
					GrouplessAPIPrefixes: sets.NewString("api"),
				}
				requestInfo, err := requestInfoFactory.NewRequestInfo(r)
				if err != nil {
					ctxLog.Error("Failed to get request info", "error", err)
					http.Error(w, "Bad Request", http.StatusBadRequest)
					return
				}

				// Validate the request against the custom route identifier
				if err := b.validateCustomRouteRequest(id, requestInfo, r.Method); err != nil {
					ctxLog.Error("Custom route validation failed", "error", err)
					http.Error(w, "Bad Request", http.StatusBadRequest)
					return
				}

				// the existing resourceID needs info from the request
				resourceID.Namespace = requestInfo.Namespace
				resourceID.Name = requestInfo.Name

				// Create the custom route request
				customRequest := &app.ResourceCustomRouteRequest{
					ResourceIdentifier: resourceID,
					SubresourcePath:    requestInfo.Subresource + "?" + r.URL.RawQuery,
					Method:             r.Method,
					Headers:            r.Header,
				}

				// Read the request body if present
				if r.Body != nil {
					body, err := io.ReadAll(r.Body)
					if err != nil {
						ctxLog.Error("Failed to read request body", "error", err)
						http.Error(w, "Bad Request", http.StatusBadRequest)
						return
					}
					customRequest.Body = body
				}

				// Call the custom route handler
				response, err := cr(r.Context(), customRequest)
				if err != nil {
					ctxLog.Error("Failed to call custom route handler", "error", err)
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
					return
				}

				// Set response headers
				for k, v := range response.Headers {
					for _, val := range v {
						w.Header().Add(k, val)
					}
				}

				// Set status code and write response body
				w.WriteHeader(response.StatusCode)
				if response.Body != nil {
					if _, err := w.Write(response.Body); err != nil {
						ctxLog.Error("Failed to write response body", "error", err)
					}
				}
			}),
		})
	}

	return routes
}

// validateCustomRouteRequest validates that the request matches the custom route identifier
func (b *appBuilder) validateCustomRouteRequest(id app.CustomRouteIdentifier, requestInfo *request.RequestInfo, method string) error {
	if requestInfo.Namespace == "" {
		return fmt.Errorf("namespace not found in request")
	}

	if id.Method != "" && id.Method != method {
		return fmt.Errorf("method not allowed")
	}

	if requestInfo.APIGroup != id.ResourceIdentifier.Group {
		return fmt.Errorf("group mismatch: expected %s, got %s", id.ResourceIdentifier.Group, requestInfo.APIGroup)
	}

	if requestInfo.APIVersion != id.ResourceIdentifier.Version {
		return fmt.Errorf("version mismatch: expected %s, got %s", id.ResourceIdentifier.Version, requestInfo.APIVersion)
	}

	if requestInfo.Resource != id.ResourceIdentifier.Plural {
		return fmt.Errorf("resource mismatch: expected %s, got %s", id.ResourceIdentifier.Plural, requestInfo.Resource)
	}

	// Only validate subresource if both are non-empty
	if id.SubresourcePath != "" && requestInfo.Subresource != "" && id.SubresourcePath != requestInfo.Subresource {
		return fmt.Errorf("subresource mismatch: expected %s, got %s", id.SubresourcePath, requestInfo.Subresource)
	}

	return nil
}
