package coordination

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"

	claims "github.com/grafana/authlib/types"
	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
	"github.com/grafana/grafana/apps/coordination/pkg/apis/manifestdata"
	coordinationapp "github.com/grafana/grafana/apps/coordination/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

var (
	_ appsdkapiserver.AppInstaller                        = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider                     = (*AppInstaller)(nil)
	_ appinstaller.ClusterScopedStorageAuthorizerProvider = (*AppInstaller)(nil)
)

// AppInstaller installs the coordination app, which serves two coordination.grafana.app
// kinds: a namespaced Lease for tenant-scoped coordination, and a cluster-scoped
// ClusterLease for fleet-level coordination (leader election and shard ownership
// across a multi-tenant operator's replicas) that is owned by no tenant.
type AppInstaller struct {
	appsdkapiserver.AppInstaller
	logger log.Logger
}

// RegisterAppInstaller builds the coordination app installer.
func RegisterAppInstaller() (*AppInstaller, error) {
	installer := &AppInstaller{
		logger: log.New("coordination.api"),
	}
	// Run the lease garbage collector on the served app: it watches Leases and
	// ClusterLeases and deletes those abandoned past the grace period.
	specificConfig := &coordinationapp.CoordinationConfig{EnableGarbageCollector: true}
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), specificConfig, coordinationapp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData:   *manifestdata.LocalManifest().ManifestData,
		SpecificConfig: specificConfig,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

// GetAuthorizer is the API-level authorizer for both kinds. Coordination leases are
// default-deny to regular users: only Grafana admins (on-prem) and service identities
// (service accounts / access policies, in Cloud) may reach them. For the namespaced
// Lease, the caller's namespace-scoped token additionally confines it to its own
// tenant; for the cluster-scoped ClusterLease, the storage authorizer (below) is the
// fail-closed backstop and adds per-service owner scoping.
func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}
			requester, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid identity is required", err
			}
			if isServiceIdentity(requester) {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "coordination leases are restricted to service identities", nil
		},
	)
}

// GetClusterScopedStorageAuthorizer returns the storage-level authorizer for the
// cluster-scoped ClusterLease. Implementing this is the mandatory opt-in for
// cluster-scoped storage; it gates create/update/delete/get/list AND watch, so a
// tenant token can neither mutate nor observe fleet leases, and it scopes each
// service to the leases it owns. Returning nil for any other resource keeps the
// default deny authorizer (fail-closed). The namespaced Lease does not reach here —
// it uses ordinary namespace-scoped storage.
func (a *AppInstaller) GetClusterScopedStorageAuthorizer(gr schema.GroupResource) storewrapper.ResourceStorageAuthorizer {
	if gr.Resource != coordinationv0alpha1.ClusterLeaseKind().Plural() {
		return nil
	}
	return &leaseStorageAuthorizer{logger: a.logger}
}

// isServiceIdentity reports whether the requester may act on coordination leases:
// a Grafana server admin, or a non-human service identity (service account or
// access policy). Everything else — regular tenant users, anonymous — is denied.
func isServiceIdentity(requester identity.Requester) bool {
	if requester.GetIsGrafanaAdmin() {
		return true
	}
	return requester.IsIdentityType(claims.TypeServiceAccount, claims.TypeAccessPolicy)
}
