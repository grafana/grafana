package ofrep

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var _ registry.BackgroundService = (*APIBuilder)(nil)

const ofrepPath = "/ofrep/v1/evaluate/flags"

const namespaceMismatchMsg = "rejecting request with namespace mismatch"
const bodyReadFailureMsg = "rejecting request with body read failure"
const mib = 1024 * 1024

type evalContext struct {
	namespace string
	slug      string
}

// NOTE: this is not an apiserver/builder, but we are keeping the name temporarily to avoid too many git changes
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

	// Register routes during construction (wire DI), which completes before any
	// background service starts. Registering in Run would race the HTTP server's
	// own background service, which binds the accumulated routes to its mux.
	b.RegisterHTTPRoutes(rr)
	return b, nil
}

// Run implements registry.BackgroundService. Routes are registered during
// construction (see ProvideService), so there is nothing to do here beyond
// staying alive until the server shuts down.
func (b *APIBuilder) Run(ctx context.Context) error {
	<-ctx.Done()
	return nil
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
