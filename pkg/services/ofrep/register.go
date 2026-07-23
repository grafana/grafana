package ofrep

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
)

const ofrepPath = "/ofrep/v1/evaluate/flags"

const namespaceMismatchMsg = "rejecting request with namespace mismatch"
const bodyReadFailureMsg = "rejecting request with body read failure"
const mib = 1024 * 1024

type evalContext struct {
	namespace string
	slug      string
}

type APIBuilder struct {
	providerType    setting.OpenFeatureProviderType
	url             *url.URL
	transport       *http.Transport
	staticEvaluator featuremgmt.StaticFlagEvaluator
	logger          log.Logger
}

func newAPIBuilder(providerType setting.OpenFeatureProviderType, url *url.URL, insecure bool, caFile string, staticEvaluator featuremgmt.StaticFlagEvaluator) (*APIBuilder, error) {
	caRoot, err := getCARoot(caFile)
	if err != nil {
		return nil, err
	}

	// raise per-host idle conn limit above the default of 2 to avoid TCP connection piling up at high request rates
	transport := &http.Transport{
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: insecure, RootCAs: caRoot},
		MaxIdleConnsPerHost: 10,
	}

	return &APIBuilder{
		providerType:    providerType,
		url:             url,
		transport:       transport,
		staticEvaluator: staticEvaluator,
		logger:          log.New("grafana-apiserver.feature-flags"),
	}, nil
}

func ProvideService(cfg *setting.Cfg, rr routing.RouteRegister) (*APIBuilder, error) {
	var staticEvaluator featuremgmt.StaticFlagEvaluator //  No static evaluator needed for non-static provider
	var err error
	if cfg.OpenFeature.ProviderType == setting.StaticProviderType {
		staticEvaluator, err = featuremgmt.CreateStaticEvaluator(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to create static evaluator: %w", err)
		}
	}

	b, err := newAPIBuilder(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, true, "", staticEvaluator)
	if err != nil {
		return nil, err
	}

	b.RegisterHTTPRoutes(rr)
	return b, nil
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

	if b.providerType == setting.FeaturesServiceProviderType || b.providerType == setting.OFREPProviderType {
		evalCtx, err := b.readEvalContext(w, r)
		if err != nil {
			_ = tracing.Errorf(span, bodyReadFailureMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
			b.logger.Error(bodyReadFailureMsg, "error", err, "flag", flagKey)
			http.Error(w, bodyReadFailureMsg, http.StatusBadRequest)
			return
		}

		authNamespace, valid := b.validateNamespace(r, evalCtx.namespace)
		b.logger.Debug("validating namespace in oneFlagHandler handler", "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "valid", valid, "flag", flagKey)
		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug, "flag", flagKey)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}

		b.proxyFlagReq(ctx, flagKey, isAuthedReq, authNamespace, w, r)
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
		evalCtx, err := b.readEvalContext(w, r)
		if err != nil {
			_ = tracing.Errorf(span, bodyReadFailureMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusBadRequest))
			b.logger.Error(bodyReadFailureMsg, "error", err)
			http.Error(w, bodyReadFailureMsg, http.StatusBadRequest)
			return
		}

		authNamespace, valid := b.validateNamespace(r, evalCtx.namespace)
		b.logger.Debug("validating namespace in allFlagsHandler handler", "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "valid", valid)

		if !valid {
			_ = tracing.Errorf(span, namespaceMismatchMsg)
			span.SetAttributes(semconv.HTTPStatusCode(http.StatusUnauthorized))
			b.logger.Error(namespaceMismatchMsg, "authNamespace", authNamespace, "evalCtxNamespace", evalCtx.namespace, "slug", evalCtx.slug)
			http.Error(w, namespaceMismatchMsg, http.StatusUnauthorized)
			return
		}

		b.proxyAllFlagReq(ctx, isAuthedReq, authNamespace, w, r)
		return
	}

	b.evalAllFlagsStatic(ctx, w)
}

func writeResponse(statusCode int, result any, logger log.Logger, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(result); err != nil {
		logger.Error("Failed to encode flag evaluation result", "error", err)
	}
}

// parseEvalContextBody parses the evaluation context fields from a request body.
func parseEvalContextBody(body []byte) (evalContext, error) {
	var raw struct {
		Context struct {
			Namespace string `json:"namespace"`
			Slug      string `json:"slug"`
		} `json:"context"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return evalContext{}, err
	}
	return evalContext{namespace: raw.Context.Namespace, slug: raw.Context.Slug}, nil
}

// readEvalContext reads the request body, re-buffers it for downstream use,
// and parses the evaluation context fields needed for validation and logging.
func (b *APIBuilder) readEvalContext(w http.ResponseWriter, r *http.Request) (evalContext, error) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, mib))
	if err != nil {
		return evalContext{}, err
	}
	r.Body = io.NopCloser(bytes.NewBuffer(body))

	b.logger.Debug("evaluation context from request", "ctx", string(body))

	if len(bytes.TrimSpace(body)) == 0 {
		return evalContext{}, nil
	}

	evalCtx, err := parseEvalContextBody(body)
	if err != nil {
		b.logger.Warn("failed to unmarshal evaluation context", "error", err)
		return evalContext{}, err
	}
	return evalCtx, nil
}

// isAuthenticatedRequest returns true if the request is authenticated
func (b *APIBuilder) isAuthenticatedRequest(r *http.Request) bool {
	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		return false
	}
	return user.GetIdentityType() != types.TypeUnauthenticated
}

func getCARoot(caFile string) (*x509.CertPool, error) {
	if caFile == "" {
		return nil, nil
	}
	// It should be safe to ignore since caFile is passed as --internal.root-ca-file flag of apiserver
	// nolint:gosec
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}
	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)
	return caCertPool, nil
}

// validateNamespace checks if the namespace in the evaluation context matches the auth namespace.
// Returns the resolved auth namespace and whether validation passed.
func (b *APIBuilder) validateNamespace(r *http.Request, evalCtxNamespace string) (string, bool) {
	_, span := tracing.Start(r.Context(), "ofrep.validateNamespace")
	defer span.End()

	user, ok := types.AuthInfoFrom(r.Context())
	if !ok {
		span.SetAttributes(attribute.Bool("validation.success", false))
		return "", false
	}

	var authNamespace string
	if user.GetNamespace() != "" {
		authNamespace = user.GetNamespace()
	} else {
		authNamespace = mux.Vars(r)["namespace"]
	}

	span.SetAttributes(
		attribute.String("auth_namespace", authNamespace),
		attribute.String("eval_ctx_namespace", evalCtxNamespace),
	)

	// Remote providers MUST include namespace in evaluation context
	if evalCtxNamespace == authNamespace {
		span.SetAttributes(attribute.Bool("validation.success", true))
		return authNamespace, true
	}

	span.SetAttributes(attribute.Bool("validation.success", false))
	return authNamespace, false
}
