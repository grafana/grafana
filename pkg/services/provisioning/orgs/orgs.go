package orgs

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// Provision scans a directory for provisioning config files
// and provisions the orgs in those files.
func Provision(ctx context.Context, configDirectory string) error {
	provisioner := newOrgProvisioner(log.New("provisioning.orgs"))
	return provisioner.applyChanges(ctx, configDirectory)
}

// OrgProvisioner is responsible for provisioning orgs based on
// configuration read by the `configReader`
type OrgProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
}

func newOrgProvisioner(log log.Logger) OrgProvisioner {
	return OrgProvisioner{
		log:         log,
		cfgProvider: &configReader{log: log},
	}
}

func (provisioner *OrgProvisioner) apply(ctx context.Context, cfg *configs) error {
	if err := provisioner.deleteOrgs(ctx, cfg.DeleteOrgs); err != nil {
		return err
	}

	for _, org := range cfg.Orgs {
		cmd := &models.GetOrgByIdQuery{Id: org.Id}
		err := bus.Dispatch(ctx, cmd)
		if err != nil && !errors.Is(err, models.ErrOrgNotFound) {
			return err
		}

		if errors.Is(err, models.ErrOrgNotFound) {
			provisioner.log.Info("inserting org from configuration ", "id", org.Id, "name", org.Name)
			insertCmd := createInsertCommand(org)
			if err := bus.Dispatch(ctx, insertCmd); err != nil {
				return err
			}
		} else {
			provisioner.log.Debug("updating org from configuration", "id", org.Id, "name", org.Name)
			updateCmd := createUpdateCommand(org)
			if err := bus.Dispatch(ctx, updateCmd); err != nil {
				return err
			}
		}

		if savePreferencesCmd := createSavePreferencesCommand(org); savePreferencesCmd != nil {
			provisioner.log.Debug("updating org preferences from configuration", "id", org.Id, "name", org.Name)
			fmt.Println(savePreferencesCmd)
			if err := bus.Dispatch(ctx, savePreferencesCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (provisioner *OrgProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := provisioner.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := provisioner.apply(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}

func (provisioner *OrgProvisioner) deleteOrgs(ctx context.Context, orgsToDelete []*deleteOrgConfig) error {
	for _, org := range orgsToDelete {
		cmd := &models.DeleteOrgCommand{Id: org.Id}
		if err := bus.Dispatch(ctx, cmd); err != nil {
			return err
		}
	}

	return nil
}
