package ofrep

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/proxyutil"
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
	providerType    string // TODO: is it really needed
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
				// http://localhost:3000/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags
				Path: "ofrep/v1/evaluate/flags/",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{},
				},
				Handler: b.allFlagsHandler,
			},
			{
				// http://localhost:3000/apis/features.grafana.app/v0alpha1/namespaces/default/ofrep/v1/evaluate/flags/{flagKey}
				Path: "ofrep/v1/evaluate/flags/{flagKey}",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{},
				},
				Handler: b.oneFlagHandler,
			},
			{
				// TODO: Remove, this is just for testing
				// http://localhost:6446/apis/features.grafana.app/v0alpha1/namespaces/default/test
				Path: "test",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{},
				},
				Handler: func(writer http.ResponseWriter, request *http.Request) {
					writer.WriteHeader(http.StatusOK)
					writer.Header().Set("Content-Type", "application/json")
					writer.Write([]byte(`test passed`))
				},
			},
		},
	}
}

func (b *APIBuilder) oneFlagHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	flagKey := vars["flagKey"]
	if flagKey == "" {
		http.Error(w, "flagKey parameter is required", http.StatusBadRequest)
		return
	}

	// TODO: replace with identity check ?
	ctx := contexthandler.FromContext(r.Context())
	isAuthedUser := ctx != nil && ctx.IsSignedIn
	publicFlag := isPublicFlag(flagKey)

	if !isAuthedUser && !publicFlag {
		http.Error(w, "unauthorized to evaluate flag", http.StatusUnauthorized)
		return
	}

	if b.providerType == setting.GOFFProviderType {
		// TODO: compare stackID in evalCtx and identity
		b.proxyFlagReq(flagKey, isAuthedUser, w, r)
		return
	}

	b.evalFlagStatic(flagKey, isAuthedUser, w, r)

}

func (b *APIBuilder) proxyFlagReq(flagKey string, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	proxy, err := b.newProxy(path.Join(ofrepPath, flagKey))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser && !isPublicFlag(flagKey) {
			writeResponse(http.StatusUnauthorized, struct{}{}, b.logger, w)
		}
		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) evalFlagStatic(flagKey string, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	result, err := b.staticEvaluator.EvalFlag(r.Context(), flagKey)
	if err != nil {
		http.Error(w, "failed to evaluate flag", http.StatusInternalServerError)
		return
	}

	writeResponse(http.StatusOK, result, b.logger, w)
}

func (b *APIBuilder) allFlagsHandler(w http.ResponseWriter, r *http.Request) {
	// TODO: replace with identity check ?
	ctx := contexthandler.FromContext(r.Context())
	isAuthedUser := ctx != nil && ctx.IsSignedIn

	if b.providerType == setting.GOFFProviderType {
		// TODO: compare stackID in evalCtx and identity
		b.proxyAllFlagReq(isAuthedUser, w, r)
		return
	}

	b.evalAllFlagsStatic(isAuthedUser, w, r)
}

func (b *APIBuilder) evalAllFlagsStatic(isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	result, err := b.staticEvaluator.EvalAllFlags(r.Context())
	if err != nil {
		http.Error(w, "failed to evaluate flags", http.StatusInternalServerError)
		return
	}

	if !isAuthedUser {
		var publicOnly []featuremgmt.OFREPFlag

		for _, flag := range result.Flags {
			if isPublicFlag(flag.Key) {
				publicOnly = append(publicOnly, flag)
			}
		}

		result.Flags = publicOnly
	}

	writeResponse(http.StatusOK, result, b.logger, w)
}

func (b *APIBuilder) proxyAllFlagReq(isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	proxy, err := b.newProxy(ofrepPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser {
			var result map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				return err
			}
			resp.Body.Close()

			filtered := make(map[string]any)
			for k, v := range result {
				if isPublicFlag(k) {
					filtered[k] = v
				}
			}

			writeResponse(http.StatusOK, filtered, b.logger, w)
		}

		return nil
	}

	proxy.ServeHTTP(w, r)
}
func (b *APIBuilder) newProxy(proxyPath string) (*httputil.ReverseProxy, error) {
	if proxyPath == "" {
		return nil, fmt.Errorf("proxy path is required")
	}

	if b.url == nil {
		return nil, fmt.Errorf("OpenFeatureService provider URL is not set")
	}

	var caRoot *x509.CertPool
	if b.caFile != "" {
		var err error
		caRoot, err = getCARoot(b.caFile)
		if err != nil {
			return nil, err
		}
	}

	director := func(req *http.Request) {
		req.URL.Scheme = b.url.Scheme
		req.URL.Host = b.url.Host
		req.URL.Path = proxyPath
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: b.insecure,
			RootCAs:            caRoot,
		},
	}
	return proxy, nil
}

func writeResponse(statusCode int, result any, logger log.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		logger.Error("Failed to encode flag evaluation result", "error", err)
	}
}

// TODO: public can be a property in pkg/services/featuremgmt/registry.go
var publicFlags = map[string]bool{
	"testflag": true,
}

func isPublicFlag(flagKey string) bool {
	_, exists := publicFlags[flagKey]
	return exists
}

func getCARoot(caFile string) (*x509.CertPool, error) {
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}
	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)
	return caCertPool, nil
}
