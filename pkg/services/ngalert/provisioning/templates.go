package provisioning

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"slices"
	"sort"
	"unsafe"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type TemplateService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	validator       validation.ProvenanceStatusTransitionValidator
	includeImported bool
}

func NewTemplateService(config alertmanagerConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger) *TemplateService {
	return &TemplateService{
		configStore:     config,
		provenanceStore: prov,
		xact:            xact,
		validator:       validation.ValidateProvenanceRelaxed,
		log:             log,
		includeImported: false,
	}
}

func (t *TemplateService) WithIncludeImported() *TemplateService {
	return &TemplateService{
		configStore:     t.configStore,
		provenanceStore: t.provenanceStore,
		xact:            t.xact,
		validator:       t.validator,
		log:             t.log,
		includeImported: true,
	}
}

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	var templates []definitions.NotificationTemplate

	if len(revision.Config.TemplateFiles) > 0 {
		provenances, err := t.provenanceStore.GetProvenances(ctx, orgID, (&definitions.NotificationTemplate{}).ResourceType())
		if err != nil {
			return nil, err
		}
		templates = make([]definitions.NotificationTemplate, 0, len(revision.Config.TemplateFiles))
		names := slices.Collect(maps.Keys(revision.Config.TemplateFiles))
		sort.Strings(names)
		for _, name := range names {
			content := revision.Config.TemplateFiles[name]
			provenance, ok := provenances[(&definitions.NotificationTemplate{Name: name}).ResourceID()]
			if !ok {
				provenance = models.ProvenanceNone
			}
			templates = append(templates, newNotificationTemplate(name, content, provenance, definition.GrafanaTemplateKind))
		}
	}

	var importedTemplates []definitions.NotificationTemplate
	if t.includeImported && len(revision.Config.ExtraConfigs) > 0 && len(revision.Config.ExtraConfigs[0].TemplateFiles) > 0 {
		imported := revision.Config.ExtraConfigs[0].TemplateFiles
		importedTemplates = make([]definitions.NotificationTemplate, 0, len(imported))
		names := slices.Collect(maps.Keys(imported))
		sort.Strings(names)
		for _, name := range names {
			content := imported[name]
			templates = append(templates, newNotificationTemplate(name, content, models.ProvenanceConvertedPrometheus, definition.MimirTemplateKind))
		}
	}
	return append(templates, importedTemplates...), nil
}

func (t *TemplateService) GetTemplate(ctx context.Context, orgID int64, nameOrUid string) (definitions.NotificationTemplate, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	result, found, err := t.getTemplateByName(ctx, revision, orgID, nameOrUid)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	if found {
		return result, nil
	}
	result, found, err = t.getTemplateByUID(ctx, revision, orgID, nameOrUid)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	if found {
		return result, nil
	}
	return definitions.NotificationTemplate{}, ErrTemplateNotFound.Errorf("")
}

func (t *TemplateService) UpsertTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	err := tmpl.Validate()
	if err != nil {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(err)
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	d, err := t.updateTemplate(ctx, revision, orgID, tmpl)
	if err != nil {
		if !errors.Is(err, ErrTemplateNotFound) {
			return d, err
		}
		// If template was not found, this is assumed to be a create operation except for two cases:
		// - If a ResourceVersion is provided: we should assume that this was meant to be a conditional update operation.
		// - If UID is provided: custom UID for templates is not currently supported, so this was meant to be an update
		// operation without a ResourceVersion.
		if tmpl.ResourceVersion != "" || tmpl.UID != "" {
			return definitions.NotificationTemplate{}, ErrTemplateNotFound.Errorf("")
		}
		return t.createTemplate(ctx, revision, orgID, tmpl)
	}
	return d, err
}

func (t *TemplateService) CreateTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	err := tmpl.Validate()
	if err != nil {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(err)
	}
	if tmpl.Kind == definition.MimirTemplateKind {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(errors.New("templates of kind 'Mimir' cannot be created"))
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	return t.createTemplate(ctx, revision, orgID, tmpl)
}

func (t *TemplateService) createTemplate(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	if tmpl.Kind == definition.MimirTemplateKind {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(errors.New("templates of kind 'Mimir' cannot be created"))
	}

	if revision.Config.TemplateFiles == nil {
		revision.Config.TemplateFiles = map[string]string{}
	}

	_, found := revision.Config.TemplateFiles[tmpl.Name]
	if found {
		return definitions.NotificationTemplate{}, ErrTemplateExists.Errorf("")
	}

	revision.Config.TemplateFiles[tmpl.Name] = tmpl.Template

	err := t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.SetProvenance(ctx, &tmpl, orgID, models.Provenance(tmpl.Provenance))
	})
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	return newNotificationTemplate(tmpl.Name, tmpl.Template, models.Provenance(tmpl.Provenance), tmpl.Kind), nil
}

func (t *TemplateService) UpdateTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	err := tmpl.Validate()
	if err != nil {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(err)
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	return t.updateTemplate(ctx, revision, orgID, tmpl)
}

func (t *TemplateService) updateTemplate(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error) {
	if revision.Config.TemplateFiles == nil {
		revision.Config.TemplateFiles = map[string]string{}
	}

	var found bool
	var err error
	var existing definitions.NotificationTemplate
	// if UID is specified, look by UID.
	if tmpl.UID != "" {
		existing, found, err = t.getTemplateByUID(ctx, revision, orgID, tmpl.UID)
	} else {
		existing, found, err = t.getTemplateByName(ctx, revision, orgID, tmpl.Name)
	}
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}
	if !found {
		return definitions.NotificationTemplate{}, ErrTemplateNotFound.Errorf("")
	}

	if existing.Name != tmpl.Name { // if template is renamed, check if this name is already taken
		_, ok := revision.Config.TemplateFiles[tmpl.Name]
		if ok {
			// return error if template is being renamed to one that already exists
			return definitions.NotificationTemplate{}, ErrTemplateExists.Errorf("")
		}
	}
	if existing.Kind != tmpl.Kind {
		return definitions.NotificationTemplate{}, MakeErrTemplateInvalid(errors.New("cannot change template kind"))
	}
	if existing.Provenance == definitions.Provenance(models.ProvenanceConvertedPrometheus) {
		return definitions.NotificationTemplate{}, makeErrTemplateOrigin(existing, "update")
	}
	if err := t.validator(models.Provenance(existing.Provenance), models.Provenance(tmpl.Provenance)); err != nil {
		return definitions.NotificationTemplate{}, err
	}

	err = t.checkOptimisticConcurrency(existing.Name, existing.Template, models.Provenance(tmpl.Provenance), tmpl.ResourceVersion, "update")
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	revision.Config.TemplateFiles[tmpl.Name] = tmpl.Template

	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if existing.Name != tmpl.Name { // if template by was found by UID and it's name is different, then this is the rename operation. Delete old resources.
			delete(revision.Config.TemplateFiles, existing.Name)
			err := t.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
			if err != nil {
				return err
			}
		}

		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.SetProvenance(ctx, &tmpl, orgID, models.Provenance(tmpl.Provenance))
	})
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	// if name was changed, this UID needs to be recalculated
	return newNotificationTemplate(tmpl.Name, tmpl.Template, models.Provenance(tmpl.Provenance), tmpl.Kind), nil
}

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, nameOrUid string, provenance definitions.Provenance, version string) error {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return err
	}
	existing, found, err := t.getTemplateByName(ctx, revision, orgID, nameOrUid)
	if err != nil {
		return err
	}
	if !found {
		existing, found, err = t.getTemplateByUID(ctx, revision, orgID, nameOrUid)
	}
	if err != nil {
		return err
	}
	if !found {
		return nil
	}
	if existing.Provenance == definitions.Provenance(models.ProvenanceConvertedPrometheus) {
		return makeErrTemplateOrigin(existing, "delete")
	}

	err = t.checkOptimisticConcurrency(existing.Name, existing.Template, models.Provenance(provenance), version, "delete")
	if err != nil {
		return err
	}

	if err = t.validator(models.Provenance(existing.Provenance), models.Provenance(provenance)); err != nil {
		return err
	}

	delete(revision.Config.TemplateFiles, existing.Name)

	return t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
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

func newNotificationTemplate(name, content string, provenance models.Provenance, kind definition.TemplateKind) definitions.NotificationTemplate {
	tmpl := definitions.NotificationTemplate{
		UID:        templateUID(kind, name),
		Name:       name,
		Template:   content,
		Provenance: definitions.Provenance(provenance),
		Kind:       kind,
	}
	tmpl.ResourceVersion = calculateTemplateFingerprint(content)
	return tmpl
}

func (t *TemplateService) getTemplateByName(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, name string) (definitions.NotificationTemplate, bool, error) {
	existingContent, ok := revision.Config.TemplateFiles[name]
	if !ok {
		return definitions.NotificationTemplate{}, false, nil
	}
	provenance, err := t.provenanceStore.GetProvenance(ctx, &definitions.NotificationTemplate{Name: name}, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, false, err
	}
	return newNotificationTemplate(name, existingContent, provenance, definition.GrafanaTemplateKind), true, nil
}

func (t *TemplateService) getTemplateByUID(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, uid string) (definitions.NotificationTemplate, bool, error) {
	find := func(templates map[string]string, uid string, kind definition.TemplateKind) (string, string, bool) {
		for n, tmpl := range templates {
			if templateUID(kind, n) == uid {
				return n, tmpl, true
			}
		}
		return "", "", false
	}
	var provenance models.Provenance
	name, content, ok := find(revision.Config.TemplateFiles, uid, definition.GrafanaTemplateKind)
	if !ok {
		if t.includeImported && len(revision.Config.ExtraConfigs) > 0 {
			name, content, ok = find(revision.Config.ExtraConfigs[0].TemplateFiles, uid, definition.MimirTemplateKind)
			if ok {
				return newNotificationTemplate(name, content, models.ProvenanceConvertedPrometheus, definition.MimirTemplateKind), true, nil
			}
		}
		return definitions.NotificationTemplate{}, false, nil
	}
	var err error
	provenance, err = t.provenanceStore.GetProvenance(ctx, &definitions.NotificationTemplate{Name: name}, orgID)
	if err != nil {
		return definitions.NotificationTemplate{}, false, err
	}
	return newNotificationTemplate(name, content, provenance, definition.GrafanaTemplateKind), true, nil
}

func templateUID(kind definition.TemplateKind, name string) string {
	return legacy_storage.NameToUid(fmt.Sprintf("%s|%s", string(kind), name))
}
