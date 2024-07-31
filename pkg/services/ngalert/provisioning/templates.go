package provisioning

import (
	"context"
	"fmt"
	"hash/fnv"
	"unsafe"

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
			Name:            name,
			Template:        tmpl,
			ResourceVersion: calculateTemplateFingerprint(tmpl),
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

	existing, ok := revision.Config.TemplateFiles[tmpl.Name]
	if ok {
		err = t.checkOptimisticConcurrency(tmpl.Name, existing, models.Provenance(tmpl.Provenance), tmpl.ResourceVersion, "update")
		if err != nil {
			return definitions.NotificationTemplate{}, err
		}
	} else if tmpl.ResourceVersion != "" { // if version is set then it's an update operation. Fail because resource does not exist anymore
		return definitions.NotificationTemplate{}, ErrTemplateNotFound.Errorf("")
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

	return definitions.NotificationTemplate{
		Name:            tmpl.Name,
		Template:        tmpl.Template,
		Provenance:      tmpl.Provenance,
		ResourceVersion: calculateTemplateFingerprint(tmpl.Template),
	}, nil
}

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, name string, provenance definitions.Provenance, version string) error {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}

	if revision.Config.TemplateFiles == nil {
		return nil
	}

	existing, ok := revision.Config.TemplateFiles[name]
	if !ok {
		return nil
	}

	err = t.checkOptimisticConcurrency(name, existing, models.Provenance(provenance), version, "delete")
	if err != nil {
		return err
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

func (t *TemplateService) checkOptimisticConcurrency(name, currentContent string, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			t.log.Debug("ignoring optimistic concurrency check because version was not provided", "template", name, "operation", action)
		}
		return nil
	}
	currentVersion := calculateTemplateFingerprint(currentContent)
	if currentVersion != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of template %s does not match current version %s", desiredVersion, name, currentVersion)
	}
	return nil
}

func calculateTemplateFingerprint(t string) string {
	sum := fnv.New64()
	_, _ = sum.Write(unsafe.Slice(unsafe.StringData(t), len(t))) //nolint:gosec
	return fmt.Sprintf("%016x", sum.Sum64())
}
