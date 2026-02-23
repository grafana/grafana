package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/gorilla/mux"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ builder.APIGroupBuilder = (*APIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*APIBuilder)(nil)
var _ builder.APIGroupVersionProvider = (*APIBuilder)(nil)

const ofrepPath = "/ofrep/v1/evaluate/flags"

const namespaceMismatchMsg = "rejecting request with namespace mismatch"

var groupVersion = schema.GroupVersion{
	Group:   "features.grafana.app",
	Version: "v0alpha1",
}

type APIBuilder struct {
	providerType    setting.OpenFeatureProviderType
	url             *url.URL
	insecure        bool
	caFile          string
	staticEvaluator featuremgmt.StaticFlagEvaluator
	logger          log.Logger
}

func NewAPIBuilder(providerType setting.OpenFeatureProviderType, url *url.URL, insecure bool, caFile string, staticEvaluator featuremgmt.StaticFlagEvaluator) *APIBuilder {
	return &APIBuilder{
		providerType:    providerType,
		url:             url,
		insecure:        insecure,
		caFile:          caFile,
		staticEvaluator: staticEvaluator,
		logger:          log.New("grafana-apiserver.feature-flags"),
	}
}

func RegisterAPIService(apiregistration builder.APIRegistrar, cfg *setting.Cfg) (*APIBuilder, error) {
	var staticEvaluator featuremgmt.StaticFlagEvaluator //  No static evaluator needed for non-static provider
	var err error
	if cfg.OpenFeature.ProviderType == setting.StaticProviderType {
		staticEvaluator, err = featuremgmt.CreateStaticEvaluator(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to create static evaluator: %w", err)
		}
	}

	b := NewAPIBuilder(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, true, "", staticEvaluator)
	apiregistration.RegisterAPI(b)
	return b, nil
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		// Allow all requests - we'll handle auth in the handler
		return authorizer.DecisionAllow, "", nil
	})
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return groupVersion
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	metav1.AddToGroupVersion(scheme, groupVersion)
	scheme.AddKnownTypes(groupVersion, &metav1.Status{}) // for noop
	return scheme.SetVersionPriority(groupVersion)
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}
	storage["noop"] = &NoopConnector{}
	apiGroupInfo.VersionedResourcesStorageMap[groupVersion.Version] = storage
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
}

func (b *APIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Proxy access to open feature flags"

	// Remove the NOOP connector
	delete(oas.Paths.Paths, "/apis/"+groupVersion.String()+"/namespaces/{namespace}/noop/{name}")
	return oas, nil
}

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	evaluationContext := &spec3.RequestBody{
		RequestBodyProps: spec3.RequestBodyProps{
			Description: "EvaluationContext provides ambient information for the purposes of flag evaluation",
			Content: map[string]*spec3.MediaType{
				"application/json": {
					MediaTypeProps: spec3.MediaTypeProps{
						Schema: spec.MapProperty(spec.MapProperty(nil)),
						Example: map[string]map[string]any{
							"context": {
								"targetingKey":    "1234",
								"grafana_version": "12.0.0",
							},
						},
					},
				},
			}}}

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "ofrep/v1/evaluate/flags",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Evaluate"},
							Description: "Evaluate all flags",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
							},
							RequestBody: evaluationContext,
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: spec.MapProperty(nil), // TODO... real type?
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.allFlagsHandler,
			},
			{
				Path: "ofrep/v1/evaluate/flags/{flagKey}",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Evaluate"},
							Description: "Evaluate a single flag",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "flagKey",
										In:          "path",
										Required:    true,
										Example:     "testflag",
										Description: "flag key",
										Schema:      spec.StringProperty(),
									},
								},
							},
							RequestBody: evaluationContext,
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: spec.MapProperty(nil), // TODO, real type
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.oneFlagHandler,
			},
		},
	}
}

func (b *APIBuilder) oneFlagHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.evalFlag")
	defer span.End()

	r = r.WithContext(ctx)

	flagKey := mux.Vars(r)["flagKey"]
	if flagKey == "" {
		_ = tracing.Errorf(span, "flagKey parameter is required")
		span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
		http.Error(w, "flagKey parameter is required", http.StatusBadRequest)
		return
	}

	span.SetAttributes(attribute.String("flag_key", flagKey))

	isAuthedReq := b.isAuthenticatedRequest(r)
	span.SetAttributes(attribute.Bool("authenticated", isAuthedReq))

	// Unless the request is authenticated, we only allow public flags evaluations
	if !isAuthedReq && !isPublicFlag(flagKey) {
		_ = tracing.Errorf(span, "unauthorized to evaluate flag: %s", flagKey)
		span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
		b.logger.Error("Unauthorized to evaluate flag", "flagKey", flagKey)
		http.Error(w, "unauthorized to evaluate flag", http.StatusUnauthorized)
		return
	}

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		valid, ns := b.validateNamespace(r)
		b.logger.Debug("validating namespace in oneFlagHandler handler", "namespace", ns, "valid", valid, "flag", flagKey)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}

		b.proxyFlagReq(ctx, flagKey, isAuthedReq, w, r)
		return
	}

	b.evalFlagStatic(ctx, flagKey, w)
}

func (b *APIBuilder) allFlagsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(r.Context(), "ofrep.handler.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)

	isAuthedReq := b.isAuthenticatedRequest(r)
	span.SetAttributes(attribute.Bool("authenticated", isAuthedReq))

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		valid, ns := b.validateNamespace(r)
		b.logger.Debug("validating namespace in allFlagsHandler handler", "namespace", ns, "valid", valid)

		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}

		b.proxyAllFlagReq(ctx, isAuthedReq, w, r)
		return
	}

	b.evalAllFlagsStatic(ctx, isAuthedReq, w)
}

func writeResponse(statusCode int, result any, logger log.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		logger.Error("Failed to encode flag evaluation result", "error", err)
	}
}

func (b *APIBuilder) namespaceFromEvalCtx(body []byte) string {
	// TODO: eval ctx should be added to span attributes, not log
	b.logger.Debug("evaluation context from request", "ctx", string(body))

	var evalCtx struct {
		// Extract namespace from request body without consuming it
		Context struct {
			Namespace string `json:"namespace"`
		} `json:"context"`
	}

	if err := json.Unmarshal(body, &evalCtx); err != nil {
		b.logger.Debug("Failed to unmarshal evaluation context", "error", err, "body", string(body))
		return ""
	}

	if evalCtx.Context.Namespace == "" {
		b.logger.Debug("namespace missing from evaluation context", "namespace", evalCtx.Context.Namespace)
		return ""
	}

	return evalCtx.Context.Namespace
}

// isAuthenticatedRequest returns true if the request is authenticated
func (b *APIBuilder) isAuthenticatedRequest(r *http.Request) bool {
	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		return false
	}
	return user.GetIdentityType() != types.TypeUnauthenticated
}

// validateNamespace checks if the namespace in the evaluation context matches the namespace in the request
func (b *APIBuilder) validateNamespace(r *http.Request) (bool, string) {
	_, span := tracing.Start(r.Context(), "ofrep.validateNamespace")
	defer span.End()

	var namespace string
	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		return false, ""
	}

	if user.GetNamespace() != "" {
		namespace = user.GetNamespace()
	} else {
		namespace = mux.Vars(r)["namespace"]
	}

	// Read request body for namespace validation and tracing
	body, err := io.ReadAll(r.Body)
	if err != nil {
		_ = tracing.Errorf(span, "failed to read request body: %w", err)
		b.logger.Error("Error reading evaluation request body", "error", err)
		span.SetAttributes(attribute.Bool("validation.success", false))
		return false, ""
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	span.SetAttributes(attribute.String("request.body", string(body)))

	evalCtxNamespace := b.namespaceFromEvalCtx(body)
	// Remote providers MUST include namespace in evaluation context
	if evalCtxNamespace == namespace {
		span.SetAttributes(attribute.Bool("validation.success", true))
		return true, evalCtxNamespace
	}

	span.SetAttributes(attribute.Bool("validation.success", false))
	return false, evalCtxNamespace
}
