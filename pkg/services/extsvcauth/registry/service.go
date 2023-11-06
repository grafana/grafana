package registry

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
)

var _ extsvcauth.ExternalServiceRegistry = &Registry{}

type Registry struct {
	features    featuremgmt.FeatureToggles
	logger      log.Logger
	oauthServer oauthserver.OAuth2Server
	saSvc       *extsvcaccounts.ExtSvcAccountsService
}

func ProvideExtSvcRegistry(oauthServer oauthserver.OAuth2Server, saSvc *extsvcaccounts.ExtSvcAccountsService, features featuremgmt.FeatureToggles) *Registry {
	return &Registry{
		features:    features,
		logger:      log.New("extsvcauth.registry"),
		oauthServer: oauthServer,
		saSvc:       saSvc,
	}
}

// SaveExternalService creates or updates an external service in the database. Based on the requested auth provider,
// it generates client_id, secrets and any additional provider specificities (ex: rsa keys). It also ensures that the
// associated service account has the correct permissions.
func (r *Registry) SaveExternalService(ctx context.Context, cmd *extsvcauth.ExternalServiceRegistration) (*extsvcauth.ExternalService, error) {
	switch cmd.AuthProvider {
	case extsvcauth.ServiceAccounts:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAccounts) {
			r.logger.Warn("Skipping external service authentication, flag disabled", "service", cmd.Name, "flag", featuremgmt.FlagExternalServiceAccounts)
			return nil, nil
		}
		r.logger.Debug("Routing the External Service registration to the External Service Account service", "service", cmd.Name)
		return r.saSvc.SaveExternalService(ctx, cmd)
	case extsvcauth.OAuth2Server:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
			r.logger.Warn("Skipping external service authentication, flag disabled", "service", cmd.Name, "flag", featuremgmt.FlagExternalServiceAuth)
			return nil, nil
		}
		r.logger.Debug("Routing the External Service registration to the OAuth2Server", "service", cmd.Name)
		return r.oauthServer.SaveExternalService(ctx, cmd)
	default:
		return nil, extsvcauth.ErrUnknownProvider.Errorf("unknow provider '%v'", cmd.AuthProvider)
	}
}

// RemoveExternalService removes an external service and it's associated resources from the database (ex: service account, token).
func (r *Registry) RemoveExternalService(ctx context.Context, name string) error {
	return r.saSvc.RemoveExternalService(ctx, name) // TODO (gamab) do something to handle OAuthProvider, maybe keep a mapping between extsvcnames and providers
}
