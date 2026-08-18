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

// AppInstaller installs the coordination app, which serves the cluster-scoped
// coordination.grafana.app Lease kind used for fleet-level coordination
// (leader election and shard ownership across a multi-tenant operator's replicas).
type AppInstaller struct {
	appsdkapiserver.AppInstaller
	logger log.Logger
}

// RegisterAppInstaller builds the coordination app installer.
func RegisterAppInstaller() (*AppInstaller, error) {
	installer := &AppInstaller{
		logger: log.New("coordination.api"),
	}
	provider := simple.NewAppProvider(manifestdata.LocalManifest(), nil, coordinationapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // overridden by the installer's InitializeApp method
		ManifestData: *manifestdata.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &manifestdata.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

// GetAuthorizer is the API-level authorizer. Fleet leases are owned by no tenant,
// so access is default-deny: only Grafana admins (on-prem) and service identities
// (service accounts / access policies, in Cloud) may reach the kind. Regular tenant
// users are denied. The storage authorizer (below) is the fail-closed backstop.
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
			if isFleetIdentity(requester) {
				return authorizer.DecisionAllow, "", nil
			}
			return authorizer.DecisionDeny, "coordination leases are restricted to service identities", nil
		},
	)
}

// GetClusterScopedStorageAuthorizer returns the storage-level authorizer for the
// cluster-scoped Lease kind. Implementing this is the mandatory opt-in for
// cluster-scoped storage; it gates create/update/delete/get/list AND watch, so a
// tenant token can neither mutate nor observe fleet leases. Returning nil for an
// unexpected resource keeps the default deny authorizer (fail-closed).
func (a *AppInstaller) GetClusterScopedStorageAuthorizer(gr schema.GroupResource) storewrapper.ResourceStorageAuthorizer {
	return &leaseStorageAuthorizer{logger: a.logger}
}

// isFleetIdentity reports whether the requester may act on fleet-scoped leases:
// a Grafana server admin, or a non-human service identity (service account or
// access policy). Everything else — regular tenant users, anonymous — is denied.
func isFleetIdentity(requester identity.Requester) bool {
	if requester.GetIsGrafanaAdmin() {
		return true
	}
	return requester.IsIdentityType(claims.TypeServiceAccount, claims.TypeAccessPolicy)
}
