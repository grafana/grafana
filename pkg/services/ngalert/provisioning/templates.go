package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type TemplateService struct {
	configStore     *alertmanagerConfigStoreImpl
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
}

func NewTemplateService(config AMConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TemplateService {
	return &TemplateService{
		configStore:     &alertmanagerConfigStoreImpl{store: config},
		provenanceStore: prov,
		xact:            xact,
		log:             log,
	}
}

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) (map[string]string, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if revision.cfg.TemplateFiles == nil {
		return map[string]string{}, nil
	}

	return revision.cfg.TemplateFiles, nil
}

func (t *TemplateService) SetTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	err := tmpl.Validate()
	if err != nil {
		return definitions.NotificationTemplate{}, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	if revision.cfg.TemplateFiles == nil {
		revision.cfg.TemplateFiles = map[string]string{}
	}
	revision.cfg.TemplateFiles[tmpl.Name] = tmpl.Template
	tmpls := make([]string, 0, len(revision.cfg.TemplateFiles))
	for name := range revision.cfg.TemplateFiles {
		tmpls = append(tmpls, name)
	}
	revision.cfg.AlertmanagerConfig.Templates = tmpls

	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.SetProvenance(ctx, &tmpl, orgID, models.Provenance(tmpl.Provenance))
	})
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	return tmpl, nil
}

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, name string) error {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	delete(revision.cfg.TemplateFiles, name)

	return t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		tgt := definitions.NotificationTemplate{
			Name: name,
		}
		return t.provenanceStore.DeleteProvenance(ctx, &tgt, orgID)
	})
}
