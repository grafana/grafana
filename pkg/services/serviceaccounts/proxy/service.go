package proxy

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/extsvcaccounts"
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

func (s *ServiceAccountsProxy) AddServiceAccountToken(ctx context.Context, serviceAccountID int64, cmd *serviceaccounts.AddServiceAccountTokenCommand) (*apikey.APIKey, error) {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, cmd.OrgId, serviceAccountID)
	if err != nil {
		return nil, err
	}

	if isExternalServiceAccount(sa.Login) {
		s.log.Error("unable to create tokens for external service accounts", "serviceAccountID", serviceAccountID)
		return nil, extsvcaccounts.ErrCannotCreateToken
	}

	return s.proxiedService.AddServiceAccountToken(ctx, serviceAccountID, cmd)
}

func (s *ServiceAccountsProxy) CreateServiceAccount(ctx context.Context, orgID int64, saForm *serviceaccounts.CreateServiceAccountForm) (*serviceaccounts.ServiceAccountDTO, error) {
	if !isNameValid(saForm.Name) {
		s.log.Error("Unable to create service account with a protected name", "name", saForm.Name)
		return nil, extsvcaccounts.ErrInvalidName
	}
	return s.proxiedService.CreateServiceAccount(ctx, orgID, saForm)
}

func (s *ServiceAccountsProxy) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
	if err != nil {
		return err
	}

	if isExternalServiceAccount(sa.Login) {
		s.log.Error("unable to delete external service accounts", "serviceAccountID", serviceAccountID)
		return extsvcaccounts.ErrCannotBeDeleted
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
	if !isNameValid(*saForm.Name) {
		s.log.Error("Invalid service account name", "name", *saForm.Name)
		return nil, extsvcaccounts.ErrInvalidName
	}
	sa, err := s.proxiedService.RetrieveServiceAccount(ctx, orgID, serviceAccountID)
	if err != nil {
		return nil, err
	}
	if isExternalServiceAccount(sa.Login) {
		s.log.Error("unable to update external service accounts", "serviceAccountID", serviceAccountID)
		return nil, extsvcaccounts.ErrCannotBeUpdated
	}

	return s.proxiedService.UpdateServiceAccount(ctx, orgID, serviceAccountID, saForm)
}

func isNameValid(name string) bool {
	return !strings.HasPrefix(name, serviceaccounts.ExtSvcPrefix)
}

func isExternalServiceAccount(login string) bool {
	return strings.HasPrefix(login, serviceaccounts.ServiceAccountPrefix+serviceaccounts.ExtSvcPrefix)
}
