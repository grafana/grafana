package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TemplateService struct {
	config AMConfigStore
	prov   ProvisioningStore
	xact   TransactionManager
	log    log.Logger
}

func NewTemplateService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TemplateService {
	return &TemplateService{
		config: config,
		prov:   prov,
		xact:   xact,
		log:    log,
	}
}

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) (map[string]string, error) {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := t.config.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return nil, err
	}
	if q.Result == nil {
		return nil, fmt.Errorf("no alertmanager configuration present in this org")
	}

	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return nil, err
	}

	if cfg.TemplateFiles == nil {
		return map[string]string{}, nil
	}

	return cfg.TemplateFiles, nil
}

func (t *TemplateService) SetTemplate(ctx context.Context, orgID int64, tmpl definitions.MessageTemplate, p models.Provenance) error {
	q := models.GetLatestAlertmanagerConfigurationQuery{
		OrgID: orgID,
	}
	err := t.config.GetLatestAlertmanagerConfiguration(ctx, &q)
	if err != nil {
		return err
	}

	concurrencyToken := q.Result.ConfigurationHash
	cfg, err := DeserializeAlertmanagerConfig([]byte(q.Result.AlertmanagerConfiguration))
	if err != nil {
		return err
	}

	// TODO: validate

	cfg.TemplateFiles[tmpl.Name] = tmpl.Template

	serialized, err := SerializeAlertmanagerConfig(*cfg)
	if err != nil {
		return err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      q.Result.ConfigurationVersion,
		FetchedConfigurationHash:  concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = t.config.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}
		err = t.prov.SetProvenance(ctx, tmpl, orgID, p)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}

	return nil
}
