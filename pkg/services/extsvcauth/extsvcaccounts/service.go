package extsvcaccounts

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	sa "github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type ExtSvcAccountsService struct {
	acSvc  ac.Service
	logger log.Logger
	saSvc  sa.Service
}

func ProvideExtSvcAccountsService(acSvc ac.Service, saSvc sa.Service) *ExtSvcAccountsService {
	return &ExtSvcAccountsService{
		acSvc:  acSvc,
		logger: log.New("serviceauth.extsvcaccounts"),
		saSvc:  saSvc,
	}
}

// RetrieveExtSvcAccount fetches an external service account by ID
func (esa *ExtSvcAccountsService) RetrieveExtSvcAccount(ctx context.Context, orgID, saID int64) (*extsvcauth.ExtSvcAccount, error) {
	sa, err := esa.saSvc.RetrieveServiceAccount(ctx, orgID, saID)
	if err != nil {
		return nil, err
	}
	return &extsvcauth.ExtSvcAccount{
		ID:         sa.Id,
		Login:      sa.Login,
		Name:       sa.Name,
		OrgID:      sa.OrgId,
		IsDisabled: sa.IsDisabled,
		Role:       roletype.RoleType(sa.Role),
	}, nil
}

// ManageExtSvcAccount creates, updates or deletes the service account associated with an external service
func (esa *ExtSvcAccountsService) ManageExtSvcAccount(ctx context.Context, cmd *extsvcauth.ManageExtSvcAccountCmd) (int64, error) {
	if cmd == nil {
		esa.logger.Warn("Received no input")
		return 0, nil
	}

	saID, errRetrieve := esa.saSvc.RetrieveServiceAccountIdByName(ctx, cmd.OrgID, cmd.ExtSvcSlug)
	if errRetrieve != nil && !errors.Is(errRetrieve, sa.ErrServiceAccountNotFound) {
		return 0, errRetrieve
	}

	if !cmd.Enabled || len(cmd.Permissions) == 0 {
		if saID > 0 {
			if err := esa.deleteExtSvcAccount(ctx, cmd.OrgID, cmd.ExtSvcSlug, saID); err != nil {
				esa.logger.Error("Error occurred while deleting service account",
					"service", cmd.ExtSvcSlug,
					"saID", saID,
					"error", err.Error())
				return 0, err
			}
		}
		esa.logger.Info("Skipping service account creation",
			"service", cmd.ExtSvcSlug,
			"enabled", cmd.Enabled,
			"permission count", len(cmd.Permissions),
			"saID", saID)
		return 0, nil
	}

	saID, errSave := esa.saveExtSvcAccount(ctx, &saveExtSvcAccountCmd{
		ExtSvcSlug:  cmd.ExtSvcSlug,
		OrgID:       cmd.OrgID,
		Permissions: cmd.Permissions,
		SaID:        saID,
	})
	if errSave != nil {
		esa.logger.Error("Could not save service account", "service", cmd.ExtSvcSlug, "error", errSave.Error())
		return 0, errSave
	}

	return saID, nil
}

// saveExtSvcAccount creates or updates the service account associated with an external service
func (esa *ExtSvcAccountsService) saveExtSvcAccount(ctx context.Context, cmd *saveExtSvcAccountCmd) (int64, error) {
	if cmd.SaID <= 0 {
		// Create a service account
		esa.logger.Debug("Create service account", "service", cmd.ExtSvcSlug, "orgID", cmd.OrgID)
		sa, err := esa.saSvc.CreateServiceAccount(ctx, cmd.OrgID, &sa.CreateServiceAccountForm{
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
	esa.logger.Debug("Update role permissions", "service", cmd.ExtSvcSlug, "saID", cmd.SaID)
	if err := esa.acSvc.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
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
func (esa *ExtSvcAccountsService) deleteExtSvcAccount(ctx context.Context, orgID int64, slug string, saID int64) error {
	esa.logger.Info("Delete service account", "service", slug, "saID", saID)
	if err := esa.saSvc.DeleteServiceAccount(ctx, orgID, saID); err != nil {
		return err
	}
	return esa.acSvc.DeleteExternalServiceRole(ctx, slug)
}
