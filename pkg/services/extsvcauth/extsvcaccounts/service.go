package extsvcaccounts

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type ExtSvcAccountsService struct {
	acSvc  ac.Service
	logger log.Logger
	saSvc  serviceaccounts.Service
}

func ProvideExtSvcAccountsService(acSvc ac.Service, saSvc serviceaccounts.Service) *ExtSvcAccountsService {
	return &ExtSvcAccountsService{
		acSvc:  acSvc,
		logger: log.New("serviceauth.extsvcaccounts"),
		saSvc:  saSvc,
	}
}

func (sap *ExtSvcAccountsService) RetrieveServiceAccount(ctx context.Context, orgID, saID int64) (*extsvcauth.ExtSvcAccount, error) {
	sa, err := sap.RetrieveServiceAccount(ctx, orgID, saID)
	if err != nil {
		return nil, err
	}
	return &extsvcauth.ExtSvcAccount{
		ID:         sa.ID,
		Login:      sa.Login,
		Name:       sa.Name,
		OrgID:      sa.OrgID,
		IsDisabled: sa.IsDisabled,
		Role:       sa.Role,
	}, nil
}

// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
func (sap *ExtSvcAccountsService) ManageExtSvcAccount(ctx context.Context, cmd *extsvcauth.ManageExtSvcAccountCmd) (int64, error) {
	if cmd == nil {
		sap.logger.Warn("Received no input")
		return 0, nil
	}

	saID, errRetrieve := sap.saSvc.RetrieveServiceAccountIdByName(ctx, cmd.OrgID, cmd.ExtSvcSlug)
	if errRetrieve != nil && !errors.Is(errRetrieve, serviceaccounts.ErrServiceAccountNotFound) {
		return 0, errRetrieve
	}

	if !cmd.Enabled || len(cmd.Permissions) == 0 {
		if saID > 0 {
			sap.deleteExtSvcAccount(ctx, cmd.OrgID, cmd.ExtSvcSlug, saID)
		}
		sap.logger.Info("Skipping service account creation",
			"service", cmd.ExtSvcSlug,
			"enabled", cmd.Enabled,
			"permission count", len(cmd.Permissions),
			"saID", saID)
		return 0, nil
	}

	saID, errSave := sap.saveExtSvcAccount(ctx, &saveExtSvcAccountCmd{
		ExtSvcSlug:  cmd.ExtSvcSlug,
		OrgID:       cmd.OrgID,
		Permissions: cmd.Permissions,
		SaID:        saID,
	})
	if errSave != nil {
		sap.logger.Error("Could not save service account", "service", cmd.ExtSvcSlug, "error", errSave.Error())
		return 0, errSave
	}

	return saID, nil
}

// saveExtSvcAccount creates or updates the service account associated with an external service
func (sap *ExtSvcAccountsService) saveExtSvcAccount(ctx context.Context, cmd *saveExtSvcAccountCmd) (int64, error) {
	if cmd.SaID <= 0 {
		// Create a service account
		sap.logger.Debug("Create service account", "service", cmd.ExtSvcSlug, "orgID", cmd.OrgID)
		sa, err := sap.saSvc.CreateServiceAccount(ctx, cmd.OrgID, &serviceaccounts.CreateServiceAccountForm{
			Name:       cmd.ExtSvcSlug,
			Role:       newRole(roletype.RoleNone),
			IsDisabled: newBool(false),
		})
		if err != nil {
			return 0, err
		}
		cmd.SaID = sa.Id
	}

	// update the service account's permissions
	sap.logger.Debug("Update role permissions", "service", cmd.ExtSvcSlug, "saID", cmd.SaID)
	if err := sap.acSvc.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
		OrgID:             ac.GlobalOrgID,
		Global:            true,
		ExternalServiceID: cmd.ExtSvcSlug,
		ServiceAccountID:  cmd.SaID,
		Permissions:       cmd.Permissions,
	}); err != nil {
		return 0, err
	}

	return cmd.SaID, nil
}

// deleteExtSvcAccount deletes a service account by ID and removes its associated role
func (sap *ExtSvcAccountsService) deleteExtSvcAccount(ctx context.Context, orgID int64, slug string, saID int64) error {
	sap.logger.Info("Delete service account", "service", slug, "saID", saID)
	if err := sap.saSvc.DeleteServiceAccount(ctx, orgID, saID); err != nil {
		return err
	}
	return sap.acSvc.DeleteExternalServiceRole(ctx, slug)
}
