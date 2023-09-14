package serviceauhtreg

import (
	"context"

	"github.com/grafana/grafana/pkg/extensions/accesscontrol"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceauth"
)

var _ serviceauth.ExternalServiceRegistry = &registry{}

type registry struct {
	logger      log.Logger
	acSvc       accesscontrol.Service
	saSvc       serviceaccounts.Service
	oauthServer oauthserver.OAuth2Server
}

func ProvideServiceAuthRegistry(acSvc accesscontrol.Service, saSvc serviceaccounts.Service, oauthServer oauthserver.OAuth2Server) *registry {
	return &registry{
		logger:      log.New("serviceauth.registry"),
		acSvc:       acSvc,
		saSvc:       saSvc,
		oauthServer: oauthServer,
	}
}

// SaveExternalService implements serviceauth.ExternalServiceRegistry.
func (r *registry) SaveExternalService(ctx context.Context, cmd *serviceauth.ExternalServiceRegistration) (*serviceauth.ExternalServiceDTO, error) {
	switch cmd.AuthProvider {
	case serviceauth.OAuth2Server:
		r.logger.Debug("Routing the External Service registration to the OAuth2Server", "service", cmd.Name)
		return r.oauthServer.SaveExternalService(ctx, cmd)
	case serviceauth.ServiceAccounts:
		r.logger.Debug("Handling the External Service registration", "service", cmd.Name)
		return r.SaveSATokenExternalService(ctx, cmd)
	default:
		return nil, serviceauth.ErrUnknownProvider.Errorf("unknow provider '%v'", cmd.AuthProvider)
	}
}

func (r *registry) SaveSATokenExternalService(ctx context.Context, cmd *serviceauth.ExternalServiceRegistration) (*serviceauth.ExternalServiceDTO, error) {
	return nil, nil
}
