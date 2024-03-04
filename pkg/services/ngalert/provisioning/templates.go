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

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	var templates []definitions.NotificationTemplate
	for name, tmpl := range revision.cfg.TemplateFiles {
		tmpl := definitions.NotificationTemplate{
			Name:     name,
			Template: tmpl,
		}
		provenance, err := t.provenanceStore.GetProvenance(ctx, &tmpl, orgID)
		if err != nil {
			return nil, err
		}
		tmpl.Provenance = definitions.Provenance(provenance)
		templates = append(templates, tmpl)
	}

	return templates, nil
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
