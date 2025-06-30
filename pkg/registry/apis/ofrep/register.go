package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/gorilla/mux"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ builder.APIGroupBuilder = (*APIBuilder)(nil)
var _ builder.APIGroupRouteProvider = (*APIBuilder)(nil)
var _ builder.APIGroupVersionProvider = (*APIBuilder)(nil)

const ofrepPath = "/ofrep/v1/evaluate/flags"

type APIBuilder struct {
	providerType    string
	url             *url.URL
	insecure        bool
	caFile          string
	staticEvaluator featuremgmt.StaticFlagEvaluator
	logger          log.Logger
}

func NewAPIBuilder(providerType string, url *url.URL, insecure bool, caFile string, staticEvaluator featuremgmt.StaticFlagEvaluator) *APIBuilder {
	return &APIBuilder{
		providerType:    providerType,
		url:             url,
		insecure:        insecure,
		caFile:          caFile,
		staticEvaluator: staticEvaluator,
		logger:          log.New("grafana-apiserver.feature-flags"),
	}
}

func RegisterAPIService(apiregistration builder.APIRegistrar, cfg *setting.Cfg, staticEvaluator featuremgmt.StaticFlagEvaluator) *APIBuilder {
	b := NewAPIBuilder(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, true, "", staticEvaluator)
	apiregistration.RegisterAPI(b)
	return b
}

func (b *APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		// Allow all requests - we'll handle auth in the handler
		return authorizer.DecisionAllow, "", nil
	})
}

func (b *APIBuilder) GetGroupVersion() schema.GroupVersion {
	return schema.GroupVersion{
		Group:   "features.grafana.app",
		Version: "v0alpha1",
	}
}

func (b *APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	metav1.AddToGroupVersion(scheme, b.GetGroupVersion())
	return scheme.SetVersionPriority(b.GetGroupVersion())
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
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

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "ofrep/v1/evaluate/flags/",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{},
				},
				Handler: b.allFlagsHandler,
			},
			{
				Path: "ofrep/v1/evaluate/flags/{flagKey}",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{},
				},
				Handler: b.oneFlagHandler,
			},
		},
	}
}

func (b *APIBuilder) oneFlagHandler(w http.ResponseWriter, r *http.Request) {
	if !b.validateNamespace(r) {
		b.logger.Error("stackId in evaluation context does not match requested namespace")
		http.Error(w, "stackId in evaluation context does not match requested namespace", http.StatusUnauthorized)
		return
	}

	flagKey := mux.Vars(r)["flagKey"]
	if flagKey == "" {
		http.Error(w, "flagKey parameter is required", http.StatusBadRequest)
		return
	}

	isAuthedReq := b.isAuthenticatedRequest(r)

	// Unless the request is authenticated, we only allow public flags evaluations
	if !isAuthedReq && !isPublicFlag(flagKey) {
		b.logger.Error("Unauthorized to evaluate flag", "flagKey", flagKey)
		http.Error(w, "unauthorized to evaluate flag", http.StatusUnauthorized)
		return
	}

	if b.providerType == setting.GOFFProviderType {
		b.proxyFlagReq(flagKey, isAuthedReq, w, r)
		return
	}

	b.evalFlagStatic(flagKey, w, r)
}

func (b *APIBuilder) allFlagsHandler(w http.ResponseWriter, r *http.Request) {
	if !b.validateNamespace(r) {
		b.logger.Error("stackId in evaluation context does not match requested namespace")
		http.Error(w, "stackId in evaluation context does not match requested namespace", http.StatusUnauthorized)
		return
	}

	isAuthedReq := b.isAuthenticatedRequest(r)

	if b.providerType == setting.GOFFProviderType {
		b.proxyAllFlagReq(isAuthedReq, w, r)
		return
	}

	b.evalAllFlagsStatic(isAuthedReq, w, r)
}

func writeResponse(statusCode int, result any, logger log.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		logger.Error("Failed to encode flag evaluation result", "error", err)
	}
}

func (b *APIBuilder) stackIdFromEvalCtx(body []byte) string {
	// Extract stackID from request body without consuming it
	var evalCtx struct {
		Context struct {
			StackID int32 `json:"stackId"`
		} `json:"context"`
	}

	if err := json.Unmarshal(body, &evalCtx); err != nil {
		b.logger.Debug("Failed to unmarshal evaluation context", "error", err, "body", string(body))
		return ""
	}

	if evalCtx.Context.StackID <= 0 {
		b.logger.Debug("Invalid or missing stackId in evaluation context", "stackId", evalCtx.Context.StackID)
		return ""
	}

	return strconv.Itoa(int(evalCtx.Context.StackID))
}

func removeStackPrefix(tenant string) string {
	return strings.TrimPrefix(tenant, "stacks-")
}

// isAuthenticatedRequest returns true if the request is authenticated
func (b *APIBuilder) isAuthenticatedRequest(r *http.Request) bool {
	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		return false
	}
	return user.GetIdentityType() != ""
}

// validateNamespace checks if the stackId in the evaluation context matches the namespace in the request
func (b *APIBuilder) validateNamespace(r *http.Request) bool {
	// Extract namespace from request context or URL path
	var namespace string
	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		return false
	}

	if user.GetNamespace() != "" {
		namespace = user.GetNamespace()
	} else {
		namespace = mux.Vars(r)["namespace"]
	}

	// Extract stackId from feature flag evaluation context
	body, err := io.ReadAll(r.Body)
	if err != nil {
		b.logger.Error("Error reading evaluation request body", "error", err)
		return false
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	// "default" namespace case can only occur in on-prem grafana
	if b.stackIdFromEvalCtx(body) == removeStackPrefix(namespace) || namespace == "default" {
		return true
	}

	return false
}
