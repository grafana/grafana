package registry

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
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

	extSvcProviders map[string]extsvcauth.AuthProvider
	lock            sync.Mutex
}

func ProvideExtSvcRegistry(oauthServer oauthserver.OAuth2Server, saSvc *extsvcaccounts.ExtSvcAccountsService, features featuremgmt.FeatureToggles) *Registry {
	return &Registry{
		extSvcProviders: map[string]extsvcauth.AuthProvider{},
		features:        features,
		lock:            sync.Mutex{},
		logger:          log.New("extsvcauth.registry"),
		oauthServer:     oauthServer,
		saSvc:           saSvc,
	}
}

// HasExternalService returns whether an external service has been saved with that name.
func (r *Registry) HasExternalService(ctx context.Context, name string) bool {
	_, ok := r.extSvcProviders[slugify.Slugify(name)]
	return ok
}

// RemoveExternalService removes an external service and its associated resources from the database (ex: service account, token).
func (r *Registry) RemoveExternalService(ctx context.Context, name string) error {
	provider, ok := r.extSvcProviders[slugify.Slugify(name)]
	if !ok {
		r.logger.Debug("external service not found", "service", name)
		return nil
	}

	switch provider {
	case extsvcauth.ServiceAccounts:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAccounts) {
			r.logger.Debug("Skipping External Service removal, flag disabled", "service", name, "flag", featuremgmt.FlagExternalServiceAccounts)
			return nil
		}
		r.logger.Debug("Routing External Service removal to the External Service Account service", "service", name)
		return r.saSvc.RemoveExternalService(ctx, name)
	case extsvcauth.OAuth2Server:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
			r.logger.Debug("Skipping External Service removal, flag disabled", "service", name, "flag", featuremgmt.FlagExternalServiceAccounts)
			return nil
		}
		r.logger.Debug("Routing External Service removal to the OAuth2Server", "service", name)
		return r.oauthServer.RemoveExternalService(ctx, name)
	default:
		return extsvcauth.ErrUnknownProvider.Errorf("unknow provider '%v'", provider)
	}
}

// SaveExternalService creates or updates an external service in the database. Based on the requested auth provider,
// it generates client_id, secrets and any additional provider specificities (ex: rsa keys). It also ensures that the
// associated service account has the correct permissions.
func (r *Registry) SaveExternalService(ctx context.Context, cmd *extsvcauth.ExternalServiceRegistration) (*extsvcauth.ExternalService, error) {
	// Record provider in case of removal
	r.lock.Lock()
	r.extSvcProviders[slugify.Slugify(cmd.Name)] = cmd.AuthProvider
	r.lock.Unlock()

	switch cmd.AuthProvider {
	case extsvcauth.ServiceAccounts:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAccounts) {
			r.logger.Warn("Skipping External Service authentication, flag disabled", "service", cmd.Name, "flag", featuremgmt.FlagExternalServiceAccounts)
			return nil, nil
		}
		r.logger.Debug("Routing the External Service registration to the External Service Account service", "service", cmd.Name)
		return r.saSvc.SaveExternalService(ctx, cmd)
	case extsvcauth.OAuth2Server:
		if !r.features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
			r.logger.Warn("Skipping External Service authentication, flag disabled", "service", cmd.Name, "flag", featuremgmt.FlagExternalServiceAuth)
			return nil, nil
		}
		r.logger.Debug("Routing the External Service registration to the OAuth2Server", "service", cmd.Name)
		return r.oauthServer.SaveExternalService(ctx, cmd)
	default:
		return nil, extsvcauth.ErrUnknownProvider.Errorf("unknow provider '%v'", cmd.AuthProvider)
	}
}

func (r *Registry) CleanUpOrphanedExternalServices(ctx context.Context) error {
	extsvcs := map[string]extsvcauth.AuthProvider{}
	if r.features.IsEnabled(featuremgmt.FlagExternalServiceAccounts) {
		names, err := r.saSvc.GetExternalServiceNames(ctx)
		if err != nil {
			return err
		}
		for i := range names {
			extsvcs[names[i]] = extsvcauth.ServiceAccounts
		}
	}
	// Important to run this second as the OAuth server uses External Service Accounts as well.
	if r.features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
		names, err := r.oauthServer.GetExternalServiceNames(ctx)
		if err != nil {
			return err
		}
		for i := range names {
			extsvcs[names[i]] = extsvcauth.OAuth2Server
		}
	}
	for name, provider := range extsvcs {
		// The service did not register this time. Removed?
		if _, ok := r.extSvcProviders[slugify.Slugify(name)]; !ok {
			r.logger.Info("Detected removed External Service", "service", name, "provider", provider)
			switch provider {
			case extsvcauth.ServiceAccounts:
				if err := r.saSvc.RemoveExternalService(ctx, name); err != nil {
					return err
				}
			case extsvcauth.OAuth2Server:
				if err := r.oauthServer.RemoveExternalService(ctx, name); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (r *Registry) Run(ctx context.Context) error {
	return r.CleanUpOrphanedExternalServices(ctx)
}
