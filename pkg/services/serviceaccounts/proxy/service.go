package proxy

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
	"github.com/grafana/grafana/pkg/setting"
)

// ServiceAccountsProxy is a proxy for the serviceaccounts.Service interface
// that is used to add validations to service accounts and protects external
// service accounts from being modified by users.

type ServiceAccountsProxy struct {
	log            log.Logger
	proxiedService serviceaccounts.Service
	isProxyEnabled bool
}

func ProvideServiceAccountsProxy(
	settingsProvider setting.SettingsProvider,
	ac accesscontrol.AccessControl,
	accesscontrolService accesscontrol.Service,
	features featuremgmt.FeatureToggles,
	permissionService accesscontrol.ServiceAccountPermissionsService,
	proxiedService *manager.ServiceAccountsService,
	routeRegister routing.RouteRegister,
) (*ServiceAccountsProxy, error) {
	cfg := settingsProvider.Get()
	s := &ServiceAccountsProxy{
		log:            log.New("serviceaccounts.proxy"),
		proxiedService: proxiedService,
		isProxyEnabled: cfg.ManagedServiceAccountsEnabled && features.IsEnabledGlobally(featuremgmt.FlagExternalServiceAccounts),
	}

	serviceaccountsAPI := api.NewServiceAccountsAPI(settingsProvider, s, ac, accesscontrolService, routeRegister, permissionService, features)
	serviceaccountsAPI.RegisterAPIEndpoints()

	return s, nil
}

var _ serviceaccounts.Service = (*ServiceAccountsProxy)(nil)

func (s *ServiceAccountsProxy) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	if s.isProxyEnabled {
		sa, err := s.proxiedService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{ID: serviceAccountID, OrgID: cmd.OrgId})
		if err != nil {
			return nil, err
		}

		if serviceaccounts.IsExternalServiceAccount(sa.Login) {
			s.log.Error("unable to create tokens for external service accounts", "serviceAccountID", serviceAccountID)
			return nil, extsvcaccounts.ErrCannotCreateToken
		}
	}

	return s.proxiedService.AddServiceAccountToken(ctx, serviceAccountID, cmd)
}

func (s *ServiceAccountsProxy) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	if s.isProxyEnabled {
		if !isNameValid(saForm.Name) {
			s.log.Error("Unable to create service account with a protected name", "name", saForm.Name)
			return nil, extsvcaccounts.ErrInvalidName
		}
	}
	return s.proxiedService.CreateServiceAccount(ctx, orgID, saForm)
}

func (s *ServiceAccountsProxy) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	if s.isProxyEnabled {
		sa, err := s.proxiedService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{ID: serviceAccountID, OrgID: orgID})
		if err != nil {
			return err
		}

		if serviceaccounts.IsExternalServiceAccount(sa.Login) {
			s.log.Error("unable to delete external service accounts", "serviceAccountID", serviceAccountID)
			return extsvcaccounts.ErrCannotBeDeleted
		}
	}
	return s.proxiedService.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (s *ServiceAccountsProxy) DeleteServiceAccountToken(ctx context.Context, orgID int64, serviceAccountID int64, tokenID int64) error {
	if s.isProxyEnabled {
		sa, err := s.proxiedService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgID, ID: serviceAccountID})
		if err != nil {
			return err
		}

		if serviceaccounts.IsExternalServiceAccount(sa.Login) {
			s.log.Error("unable to delete tokens for external service accounts", "serviceAccountID", serviceAccountID)
			return extsvcaccounts.ErrCannotDeleteToken
		}
	}
	return s.proxiedService.DeleteServiceAccountToken(ctx, orgID, serviceAccountID, tokenID)
}

func (s *ServiceAccountsProxy) EnableServiceAccount(ctx context.Context, orgID int64, serviceAccountID int64, enable bool) error {
	if s.isProxyEnabled {
		sa, err := s.proxiedService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgID, ID: serviceAccountID})
		if err != nil {
			return err
		}
		if serviceaccounts.IsExternalServiceAccount(sa.Login) {
			s.log.Error("unable to enable/disable external service accounts", "serviceAccountID", serviceAccountID)
			return extsvcaccounts.ErrCannotBeUpdated
		}
	}
	return s.proxiedService.EnableServiceAccount(ctx, orgID, serviceAccountID, enable)
}

func (s *ServiceAccountsProxy) ListTokens(ctx context.Context, query *serviceaccounts.GetSATokensQuery) ([]apikey.APIKey, error) {
	return s.proxiedService.ListTokens(ctx, query)
}

func (s *ServiceAccountsProxy) MigrateApiKeysToServiceAccounts(ctx context.Context, orgID int64) (*serviceaccounts.MigrationResult, error) {
	return s.proxiedService.MigrateApiKeysToServiceAccounts(ctx, orgID)
}

func (s *ServiceAccountsProxy) RetrieveServiceAccount(ctx context.Context, query *serviceaccounts.GetServiceAccountQuery) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, query)
	if err != nil {
		return nil, err
	}

	if s.isProxyEnabled {
		sa.IsExternal = serviceaccounts.IsExternalServiceAccount(sa.Login)
		sa.RequiredBy = strings.ReplaceAll(sa.Name, serviceaccounts.ExtSvcPrefix, "")
	}

	return sa, nil
}

func (s *ServiceAccountsProxy) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return s.proxiedService.RetrieveServiceAccountIdByName(ctx, orgID, name)
}

func (s *ServiceAccountsProxy) UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64, saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if s.isProxyEnabled {
		if !isNameValid(*saForm.Name) {
			s.log.Error("Invalid service account name", "name", *saForm.Name)
			return nil, extsvcaccounts.ErrInvalidName
		}
		sa, err := s.proxiedService.RetrieveServiceAccount(ctx, &serviceaccounts.GetServiceAccountQuery{OrgID: orgID, ID: serviceAccountID})
		if err != nil {
			return nil, err
		}
		if serviceaccounts.IsExternalServiceAccount(sa.Login) {
			s.log.Error("unable to update external service accounts", "serviceAccountID", serviceAccountID)
			return nil, extsvcaccounts.ErrCannotBeUpdated
		}
	}

	return s.proxiedService.UpdateServiceAccount(ctx, orgID, serviceAccountID, saForm)
}

func (s *ServiceAccountsProxy) SearchOrgServiceAccounts(ctx context.Context, query *serviceaccounts.SearchOrgServiceAccountsQuery) (*serviceaccounts.SearchOrgServiceAccountsResult, error) {
	sa, err := s.proxiedService.SearchOrgServiceAccounts(ctx, query)
	if err != nil {
		return nil, err
	}

	if s.isProxyEnabled {
		for i := range sa.ServiceAccounts {
			sa.ServiceAccounts[i].IsExternal = serviceaccounts.IsExternalServiceAccount(sa.ServiceAccounts[i].Login)
		}
	}
	return sa, nil
}

func isNameValid(name string) bool {
	return !strings.HasPrefix(name, strings.TrimSuffix(serviceaccounts.ExtSvcPrefix, "-"))
}
