package provisioning

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type TemplateService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	validator       validation.ProvenanceStatusTransitionValidator
}

func NewTemplateService(config alertmanagerConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TemplateService {
	return &TemplateService{
		configStore:     config,
		provenanceStore: prov,
		xact:            xact,
		validator:       validation.ValidateProvenanceRelaxed,
		log:             log,
	}
}

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	templates := make([]definitions.NotificationTemplate, 0, len(revision.Config.TemplateFiles))
	for name, tmpl := range revision.Config.TemplateFiles {
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

	if revision.Config.TemplateFiles == nil {
		revision.Config.TemplateFiles = map[string]string{}
	}

	_, ok := revision.Config.TemplateFiles[tmpl.Name]
	if ok {
		// check that provenance is not changed in an invalid way
		storedProvenance, err := t.provenanceStore.GetProvenance(ctx, &tmpl, orgID)
		if err != nil {
			return definitions.NotificationTemplate{}, err
		}
		if err := t.validator(storedProvenance, models.Provenance(tmpl.Provenance)); err != nil {
			return definitions.NotificationTemplate{}, err
		}
	}

	revision.Config.TemplateFiles[tmpl.Name] = tmpl.Template

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

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, name string, provenance definitions.Provenance) error {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if revision.Config.TemplateFiles == nil {
		return nil
	}

	_, ok := revision.Config.TemplateFiles[name]
	if !ok {
		return nil
	}

	// check that provenance is not changed in an invalid way
	storedProvenance, err := t.provenanceStore.GetProvenance(ctx, &definitions.NotificationTemplate{Name: name}, orgID)
	if err != nil {
		return err
	}
	if err = t.validator(storedProvenance, models.Provenance(provenance)); err != nil {
		return err
	}

	delete(revision.Config.TemplateFiles, name)

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
