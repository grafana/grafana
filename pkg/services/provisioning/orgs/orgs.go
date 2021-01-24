package orgs

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// Provision scans a directory for provisioning config files
// and provisions the orgs in those files.
func Provision(ctx context.Context, configDirectory string) error {
	provisioner := newOrgProvisioner(log.New("provisioning.orgs"))
	return provisioner.applyChanges(configDirectory)
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

func (provisioner *OrgProvisioner) apply(cfg *configs) error {
	if err := provisioner.deleteOrgs(cfg.DeleteOrgs); err != nil {
		return err
	}

	for _, org := range cfg.Orgs {
		cmd := &models.GetOrgByIdQuery{Id: org.Id}
		err := bus.Dispatch(cmd)
		if err != nil && !errors.Is(err, models.ErrOrgNotFound) {
			return err
		}

		if errors.Is(err, models.ErrOrgNotFound) {
			provisioner.log.Info("inserting org from configuration ", "id", org.Id, "name", org.Name)
			insertCmd := createInsertCommand(org)
			if err := bus.Dispatch(insertCmd); err != nil {
				return err
			}
		} else {
			provisioner.log.Debug("updating org from configuration", "id", org.Id, "name", org.Name)
			updateCmd := createUpdateCommand(org)
			if err := bus.Dispatch(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (provisioner *OrgProvisioner) applyChanges(configPath string) error {
	configs, err := provisioner.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := provisioner.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}

func (provisioner *OrgProvisioner) deleteOrgs(orgsToDelete []*deleteOrgConfig) error {
	for _, org := range orgsToDelete {
		cmd := &models.DeleteOrgCommand{Id: org.Id}
		if err := bus.Dispatch(cmd); err != nil {
			return err
		}
	}

	return nil
}
