package channelrule

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// Provision scans a directory for provisioning config files
// and provisions the channelRule in those files.
func Provision(configDirectory string, sqlStore *sqlstore.SQLStore) error {
	channelStorage, err := database.NewChannelRuleStorage(sqlStore)
	if err != nil {
		return err
	}
	dc := newProvisioner(log.New("provisioning.channel-rules"), channelStorage)
	return dc.applyChanges(configDirectory)
}

// Provisioner is responsible for provisioning channelRules based on
// configuration read by the `configReader`
type Provisioner struct {
	log         log.Logger
	cfgProvider *configReader
	storage     Storage
}

type Storage interface {
	GetChannelRule(cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	CreateChannelRule(cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	UpdateChannelRule(cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	DeleteChannelRule(cmd models.DeleteLiveChannelRuleCommand) (int64, error)
}

func newProvisioner(log log.Logger, storage Storage) Provisioner {
	return Provisioner{
		log:         log,
		cfgProvider: &configReader{log: log},
		storage:     storage,
	}
}

func (dc *Provisioner) apply(cfg *configs) error {
	if err := dc.deleteChannelRules(cfg.DeleteChannelRules); err != nil {
		return err
	}

	for _, rule := range cfg.ChannelRules {
		ruleInstance, err := dc.storage.GetChannelRule(models.GetLiveChannelRuleCommand{
			OrgId:   rule.OrgID,
			Pattern: rule.Pattern,
		})
		if err != nil && !errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return err
		}
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			dc.log.Info("inserting channel rule from configuration ", "pattern", rule.Pattern)
			insertCmd := createInsertCommand(rule)
			_, err := dc.storage.CreateChannelRule(insertCmd)
			if err != nil {
				return err
			}
		} else {
			dc.log.Debug("updating channelRule from configuration", "pattern", rule.Pattern)
			updateCmd := createUpdateCommand(rule, ruleInstance.Id)
			if updateCmd.Version == 0 {
				updateCmd.Version = ruleInstance.Version + 1
			}
			_, err := dc.storage.UpdateChannelRule(updateCmd)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *Provisioner) applyChanges(configPath string) error {
	configs, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *Provisioner) deleteChannelRules(dsToDelete []*deleteChannelRuleConfig) error {
	for _, ds := range dsToDelete {
		cmd := models.DeleteLiveChannelRuleCommand{OrgId: ds.OrgID, Pattern: ds.Pattern}
		count, err := dc.storage.DeleteChannelRule(cmd)
		if err != nil {
			return err
		}
		if count > 0 {
			dc.log.Info("deleted channel rule based on configuration", "pattern", ds.Pattern)
		}
	}
	return nil
}
