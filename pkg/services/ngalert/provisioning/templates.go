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
	revision, err := getLastConfiguration(ctx, orgID, t.config)
	if err != nil {
		return nil, err
	}

	if revision.cfg.TemplateFiles == nil {
		return map[string]string{}, nil
	}

	return revision.cfg.TemplateFiles, nil
}

func (t *TemplateService) SetTemplate(ctx context.Context, orgID int64, tmpl definitions.MessageTemplate) (definitions.MessageTemplate, error) {
	err := tmpl.Validate()
	if err != nil {
		return definitions.MessageTemplate{}, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := getLastConfiguration(ctx, orgID, t.config)
	if err != nil {
		return definitions.MessageTemplate{}, err
	}

	if revision.cfg.TemplateFiles == nil {
		revision.cfg.TemplateFiles = map[string]string{}
	}
	revision.cfg.TemplateFiles[tmpl.Name] = tmpl.Template

	serialized, err := serializeAlertmanagerConfig(*revision.cfg)
	if err != nil {
		return definitions.MessageTemplate{}, err
	}
	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.version,
		FetchedConfigurationHash:  revision.concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = t.config.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}
		err = t.prov.SetProvenance(ctx, &tmpl, orgID, tmpl.Provenance)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return definitions.MessageTemplate{}, err
	}

	return tmpl, nil
}

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, name string) error {
	revision, err := getLastConfiguration(ctx, orgID, t.config)
	if err != nil {
		return err
	}

	delete(revision.cfg.TemplateFiles, name)

	serialized, err := serializeAlertmanagerConfig(*revision.cfg)
	if err != nil {
		return err
	}

	cmd := models.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(serialized),
		ConfigurationVersion:      revision.version,
		FetchedConfigurationHash:  revision.concurrencyToken,
		Default:                   false,
		OrgID:                     orgID,
	}
	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		err = t.config.UpdateAlertmanagerConfiguration(ctx, &cmd)
		if err != nil {
			return err
		}
		tgt := definitions.MessageTemplate{
			Name: name,
		}
		err = t.prov.DeleteProvenance(ctx, &tgt, orgID)
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
