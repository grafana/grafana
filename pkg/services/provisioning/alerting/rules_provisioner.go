package alerting

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, path string) error
}

func NewAlertRuleProvisioner(logger log.Logger) AlertRuleProvisioner {
	return &DefaultAlertRuleProvisioner{
		logger:    logger,
		cfgReader: NewRulesConfigReader(logger),
	}
}

type DefaultAlertRuleProvisioner struct {
	logger    log.Logger
	cfgReader rulesConfigReader
}

func (prov *DefaultAlertRuleProvisioner) Provision(ctx context.Context, path string) error {
	prov.logger.Info("starting to provision the alert rules")
	ruleFiles, err := prov.cfgReader.readConfig(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to read alert rules files: %w", err)
	}
	prov.logger.Info("read all alert rules files", "file_count", len(ruleFiles))
	err = prov.provsionRuleFiles(ruleFiles)
	if err != nil {
		return fmt.Errorf("failed to provision alert rules: %w", err)
	}
	prov.logger.Info("finished to provision the alert rules")
	return nil
}

func (prov *DefaultAlertRuleProvisioner) provsionRuleFiles(ruleFiles []*RuleFileV1) error {
	for _, file := range ruleFiles {
		for _, group := range file.Groups {
			prov.logger.Info("provisioning alert rule group", "org", group.OrgID.Value(), "folder", group.Folder.Value(), "name", group.Name.Value())
			for _, rule := range group.Rules {
				prov.logger.Info("provisioning alert rule", "uid", rule.UID.Value(), "title", rule.Title.Value())
			}
		}
	}
	return nil
}
