package orgs

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

// Provision scans a directory for provisioning config files
// and provisions the orgs in those files.
func Provision(ctx context.Context, configDirectory string, orgService org.Service) error {
	logger := log.New("provisioning.orgs")
	op := OrgProvisioner{
		log:         logger,
		cfgProvider: newConfigReader(logger),
		orgService:  orgService,
	}
	return op.applyChanges(ctx, configDirectory)
}

// OrgProvisioner is responsible for provisioning orgs based on
// configuration read by the `configReader`
type OrgProvisioner struct {
	log         log.Logger
	cfgProvider configReader
	orgService  org.Service
	userService user.Service
}

func (op *OrgProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := op.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := op.apply(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}

func (op *OrgProvisioner) apply(ctx context.Context, cfg *orgFile) error {
	for _, createOrg := range cfg.CreateOrgs {
		_, err := op.orgService.GetByName(ctx, &org.GetOrgByNameQuery{
			Name: createOrg.Name,
		})

		if err == nil {
			// org already exists
			continue
		}

		existingUser, err := op.userService.GetByLogin(ctx, &user.GetUserByLoginQuery{
			LoginOrEmail: createOrg.InitialAdminLoginOrEmail,
		})

		if err != nil {
			op.log.Warn("user not found when creating org ", "name", createOrg.Name, "initialAdminLoginOrEmail", createOrg.InitialAdminLoginOrEmail)
			continue
		}

		op.log.Info("creating org from configuration ", "name", createOrg.Name)
		_, err = op.orgService.CreateWithMember(ctx, &org.CreateOrgCommand{
			Name:   createOrg.Name,
			UserID: existingUser.ID,
		})
		if err != nil {
			return err
		}
	}
	for _, deleteOrg := range cfg.DeleteOrgs {
		existingOrg, err := op.orgService.GetByName(ctx, &org.GetOrgByNameQuery{
			Name: deleteOrg.Name,
		})

		if err != nil {
			// ignore not existing org or other errors
			continue
		}

		op.log.Info("deleting org from configuration ", "name", deleteOrg.Name)
		err = op.orgService.Delete(ctx, &org.DeleteOrgCommand{
			ID: existingOrg.ID,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
