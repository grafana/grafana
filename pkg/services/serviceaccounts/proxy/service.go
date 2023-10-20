package proxy

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/extsvcauth/extsvcaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/manager"
)

// ServiceAccountsProxy is a proxy for the serviceaccounts.Service interface
// that is used to add validations to service accounts and protects external
// service accounts from being modified by users.

type ServiceAccountsProxy struct {
	log            log.Logger
	proxiedService serviceaccounts.Service
}

func ProvideServiceAccountsProxy(
	proxiedService *manager.ServiceAccountsService,
) (*ServiceAccountsProxy, error) {
	s := &ServiceAccountsProxy{
		log:            log.New("serviceaccounts.proxy"),
		proxiedService: proxiedService,
	}
	return s, nil
}

var _ serviceaccounts.Service = (*ServiceAccountsProxy)(nil)

func (s *ServiceAccountsProxy) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	if isNameValid(saForm.Name) {
		s.log.Info("Unable to create service account with a protected name", "name", saForm.Name)
		return nil, extsvcaccounts.ErrExtServiceAccountInvalidName
	}
	return s.proxiedService.CreateServiceAccount(ctx, orgID, saForm)
}

func (s *ServiceAccountsProxy) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
	if err != nil {
		return err
	}

	if isExternalServiceAccount(sa.Login) {
		s.log.Info("unable to delete external service accounts", "serviceAccountID", serviceAccountID)
		return extsvcaccounts.ErrExtServiceAccountCannotBeDeleted
	}

	return s.proxiedService.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (s *ServiceAccountsProxy) RetrieveServiceAccount(ctx context.Context, orgID, serviceAccountID int64) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
	if err != nil {
		return nil, err
	}

	sa.IsExternal = isExternalServiceAccount(sa.Login)

	return sa, nil
}

func (s *ServiceAccountsProxy) RetrieveServiceAccountIdByName(ctx context.Context, orgID int64, name string) (int64, error) {
	return s.proxiedService.RetrieveServiceAccountIdByName(ctx, orgID, name)
}

func (s *ServiceAccountsProxy) UpdateServiceAccount(ctx context.Context, orgID, serviceAccountID int64, saForm *serviceaccounts.UpdateServiceAccountForm) (*serviceaccounts.ServiceAccountProfileDTO, error) {
	if isExternalServiceAccount(*saForm.Name) {
		s.log.Info("Invalid service account name", "name", *saForm.Name)
		return nil, extsvcaccounts.ErrExtServiceAccountInvalidName
	}
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
	if err != nil {
		return nil, err
	}
	if isExternalServiceAccount(sa.Login) {
		s.log.Info("unable to update external service accounts", "serviceAccountID", serviceAccountID)
		return nil, extsvcaccounts.ErrExtServiceAccountCannotBeUpdated
	}

	return s.proxiedService.UpdateServiceAccount(ctx, orgID, serviceAccountID, saForm)
}

func (s *ServiceAccountsProxy) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, cmd.OrgId, serviceAccountID)
	if err != nil {
		return nil, err
	}

	if isExternalServiceAccount(sa.Login) {
		s.log.Info("unable to create tokens for external service accounts", "serviceAccountID", serviceAccountID)
		return nil, extsvcaccounts.ErrExtServiceAccountCannotCreateToken
	}

	return s.proxiedService.AddServiceAccountToken(ctx, serviceAccountID, cmd)
}

func isNameValid(name string) bool {
	return strings.HasPrefix(name, extsvcaccounts.ExtsvcPrefix)
}

func isExternalServiceAccount(login string) bool {
	return strings.HasPrefix(login, serviceaccounts.ServiceAccountPrefix+extsvcaccounts.ExtsvcPrefix)
}
