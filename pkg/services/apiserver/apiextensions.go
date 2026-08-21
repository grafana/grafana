package apiserver

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"

	authlib "github.com/grafana/authlib/types"

	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/apiserver/aggregatorrunner"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// noopAPIServiceRegistration satisfies autoregister.AutoAPIServiceRegistration
// with no-ops. It is used to run the CRD registration controller when the
// single-tenant aggregator is disabled: in that mode there is no APIService
// registry to sync, but the controller's other job — dynamically registering
// per-CRD-group authorizers — is still required for CRD-backed APIs to be
// authorized against RBAC permissions instead of the org-role fallback.
type noopAPIServiceRegistration struct{}

func (noopAPIServiceRegistration) AddAPIServiceToSyncOnStart(*apiregistrationv1.APIService) {}
func (noopAPIServiceRegistration) AddAPIServiceToSync(*apiregistrationv1.APIService)        {}
func (noopAPIServiceRegistration) RemoveAPIServiceToSync(string)                            {}

// ApiExtensionsDelegateConfig carries the single-tenant runtime dependencies the
// embedded apiextensions server needs. It is populated by the apiserver service
// during start() and passed to ApiExtensionsRunner.BuildDelegate. The concrete
// apiextensions server lives in enterprise code; OSS only sees this neutral shape.
type ApiExtensionsDelegateConfig struct {
	// ServerConfig is the completed-but-not-yet-New RecommendedConfig of the core
	// grafana-apiserver. A shallow copy is taken by the apiextensions server so it
	// can install the CRD/CR handlers with its own RESTOptionsGetter.
	ServerConfig *genericapiserver.RecommendedConfig
	// Scheme is the shared apiserver scheme.
	Scheme *runtime.Scheme
	// RESTOptionsGetter is the single-tenant unified-storage backed getter
	// (apistore) used as the base for CRD/CR storage.
	RESTOptionsGetter genericregistry.RESTOptionsGetter
	// StorageClient is the single local unified-storage ResourceClient. In ST the
	// same client is used for both cluster-scoped (service identity) and
	// namespace-scoped (user identity via request context) access, so no OBO
	// token exchange is required.
	StorageClient resource.ResourceClient
	// AccessClient is the in-process RBAC access client.
	AccessClient authlib.AccessClient
	// AuthorizerRegistry is the ST authorizer, which supports dynamic per-CRD-group
	// authorizer (un)registration.
	AuthorizerRegistry *authorizer.GrafanaAuthorizer
	// BuildHandlerChainFunc is the ST handler chain, so CRD-backed requests run
	// through the same authn/authz/tracing middleware as core groups.
	BuildHandlerChainFunc builder.BuildHandlerChainFunc
	// SecureValues supports inline secure values on stored custom resources.
	SecureValues secret.InlineSecureValueSupport
	// ConfigProvider yields a loopback rest config for provisioning/secure values.
	ConfigProvider apistore.RestConfigProvider
	// Metrics is the prometheus registerer.
	Metrics prometheus.Registerer
	// Delegate is the downstream delegation target (typically the notFound handler)
	// that the apiextensions server should delegate to for anything it does not serve.
	Delegate genericapiserver.DelegationTarget
}

// ApiExtensionsRunner is the enterprise hook that builds an embedded
// apiextensions apiserver and chains it into the single-tenant delegation chain.
// OSS provides a no-op implementation; enterprise wires the real one.
type ApiExtensionsRunner interface {
	// IsEnabled reports whether embedded apiextensions is turned on.
	IsEnabled() bool
	// BuildDelegate constructs the apiextensions server delegating to cfg.Delegate
	// and returns the new delegation target to place in front of it, plus an
	// AutoRegistrationControllerProvider (nil when disabled) so CRD groups can be
	// registered into the aggregator's aggregated discovery when it is enabled.
	BuildDelegate(ctx context.Context, cfg ApiExtensionsDelegateConfig) (genericapiserver.DelegationTarget, aggregatorrunner.AutoRegistrationControllerProvider, error)
}

// NoopApiExtensionsRunner is the OSS default: embedded apiextensions is an
// enterprise-only feature, so this is always disabled and never builds anything.
type NoopApiExtensionsRunner struct{}

func (NoopApiExtensionsRunner) IsEnabled() bool { return false }

func (NoopApiExtensionsRunner) BuildDelegate(_ context.Context, cfg ApiExtensionsDelegateConfig) (genericapiserver.DelegationTarget, aggregatorrunner.AutoRegistrationControllerProvider, error) {
	return cfg.Delegate, nil, nil
}

// ProvideNoopApiExtensionsRunner provides the OSS no-op runner.
func ProvideNoopApiExtensionsRunner() ApiExtensionsRunner {
	return NoopApiExtensionsRunner{}
}
