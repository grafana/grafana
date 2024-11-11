package orgs

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
)

// Provision scans a directory for provisioning config files
// and provisions the organizations in those files.
func Provision(ctx context.Context, configDirectory string, orgService org.Service) error {
	dc := newOrgProvisioner(log.New("provisioning.organizations"), orgService)
	return dc.applyChanges(ctx, configDirectory)
}

// OrgProvisioner is responsible for provisioning organizations based on
// configuration read by the `configReader`
type OrgProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
	orgService  org.Service
}

func newOrgProvisioner(log log.Logger, orgService org.Service) OrgProvisioner {
	return OrgProvisioner{
		log:         log,
		cfgProvider: newConfigReader(log),
		orgService:  orgService,
	}
}

func (dc *OrgProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := dc.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.provisionOrgs(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *OrgProvisioner) provisionOrgs(ctx context.Context, cfg *configs) error {
	if err := dc.deleteOrgs(ctx, cfg); err != nil {
		return err
	}

	for _, o := range cfg.Orgs {
		cmd := &org.GetOrgByIDQuery{ID: o.ID}
		_, err := dc.orgService.GetByID(ctx, cmd)
		if err != nil && !errors.Is(err, org.ErrOrgNotFound) {
			return err
		}

		if errors.Is(err, org.ErrOrgNotFound) {
			dc.log.Info("inserting org from configuration ", "id", o.ID, "name", o.Name)
			_, err := dc.orgService.CreateWithMember(ctx, &org.CreateOrgCommand{
				ID:   o.ID,
				Name: o.Name,
			})
			if err != nil {
				return err
			}
		} else {
			dc.log.Debug("updating org from configuration", "id", o.ID, "name", o.Name)
			err := dc.orgService.UpdateOrg(ctx, &org.UpdateOrgCommand{
				OrgId: o.ID,
				Name:  o.Name,
			})
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *OrgProvisioner) deleteOrgs(ctx context.Context, cfg *configs) error {
	for _, o := range cfg.DeleteOrgs {
		cmd := &org.DeleteOrgCommand{ID: o.ID}
		if err := dc.orgService.Delete(ctx, cmd); err != nil {
			return err
		}

	}

	return nil
}
