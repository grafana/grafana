package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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
	return nil
}

func (b *APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	return nil
}

func (b *APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
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
	ctx := contexthandler.FromContext(r.Context())
	isAuthedUser := ctx.IsSignedIn

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	stackID := stackIdFromEvalCtx(body)
	if removeStackPrefix(ctx.SignedInUser.Namespace) != stackID {
		http.Error(w, "stackID in evaluation context does not match requested namespace", http.StatusBadRequest) // Or maybe StatusUnauthorized?
		return
	}

	vars := mux.Vars(r)
	flagKey := vars["flagKey"]
	if flagKey == "" {
		http.Error(w, "flagKey parameter is required", http.StatusBadRequest)
		return
	}

	publicFlag := isPublicFlag(flagKey)

	if !isAuthedUser && !publicFlag {
		http.Error(w, "unauthorized to evaluate flag", http.StatusUnauthorized)
		return
	}

	if b.providerType == setting.GOFFProviderType {
		b.proxyFlagReq(flagKey, isAuthedUser, w, r)
		return
	}

	b.evalFlagStatic(flagKey, isAuthedUser, w, r)
}

func (b *APIBuilder) allFlagsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := contexthandler.FromContext(r.Context())
	isAuthedUser := ctx.IsSignedIn

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read request body", http.StatusBadRequest)
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	stackID := stackIdFromEvalCtx(body)
	if removeStackPrefix(ctx.Namespace) != stackID {
		http.Error(w, "stackID in evaluation context does not match requested namespace", http.StatusBadRequest) // Or maybe StatusUnauthorized?
		return
	}

	if b.providerType == setting.GOFFProviderType {
		b.proxyAllFlagReq(isAuthedUser, w, r)
		return
	}

	b.evalAllFlagsStatic(isAuthedUser, w, r)
}

func writeResponse(statusCode int, result any, logger log.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		logger.Error("Failed to encode flag evaluation result", "error", err)
	}
}

func stackIdFromEvalCtx(b []byte) string {
	// Extract stackID from request body without consuming it
	var evalCtx struct {
		Context struct {
			StackID string `json:"stackId"`
		} `json:"context"`
	}

	if err := json.Unmarshal(b, &evalCtx); err != nil {
		return ""
	}
	return evalCtx.Context.StackID
}

func removeStackPrefix(tenant string) string {
	return strings.TrimPrefix(tenant, "stacks-")
}
