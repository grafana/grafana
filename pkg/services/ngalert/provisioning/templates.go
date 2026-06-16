package provisioning

import (
	"cmp"
	"context"
	"errors"
	"slices"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	notifymerge "github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

type TemplateService struct {
	configStore     alertmanagerConfigStore
	provenanceStore ProvisioningStore
	xact            TransactionManager
	log             log.Logger
	validator       validation.ProvenanceStatusTransitionValidator
	limitsProvider  LimitsProvider
	includeImported bool
}

func NewTemplateService(config alertmanagerConfigStore, prov ProvisioningStore, xact TransactionManager, log log.Logger, validator validation.ProvenanceStatusTransitionValidator) *TemplateService {
	return &TemplateService{
		configStore:     config,
		provenanceStore: prov,
		xact:            xact,
		validator:       validator,
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
		limitsProvider:  t.limitsProvider,
		includeImported: true,
	}
}

// WithLimitsProvider returns a new TemplateService with the given limits provider.
// This is used for remote alertmanager mode to validate template limits before creation/update.
func (t *TemplateService) WithLimitsProvider(limits LimitsProvider) *TemplateService {
	return &TemplateService{
		configStore:     t.configStore,
		provenanceStore: t.provenanceStore,
		xact:            t.xact,
		validator:       t.validator,
		log:             t.log,
		limitsProvider:  limits,
		includeImported: t.includeImported,
	}
}

func (t *TemplateService) GetTemplates(ctx context.Context, orgID int64) ([]v1.TemplateGroup, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return nil, err
	}

	allTemplates := revision.Config.Templates
	var importedUIDs []v1.ResourceUID

	if t.includeImported && len(revision.Config.ExtraConfigs) > 0 && len(revision.Config.ExtraConfigs[0].TemplateFiles) > 0 {
		extraCfg := revision.Config.ExtraConfigs[0]
		var mergeErr error
		allTemplates, _, importedUIDs, mergeErr = notifymerge.MergeTemplates(revision.Config.Templates, extraCfg.TemplateFiles, extraCfg.Identifier)
		if mergeErr != nil {
			return nil, mergeErr
		}
	}

	if len(allTemplates) == 0 {
		return nil, nil
	}

	provenances, err := t.provenanceStore.GetProvenances(ctx, orgID, (&v1.TemplateGroup{}).ResourceType())
	if err != nil {
		return nil, err
	}

	imported := make(map[v1.ResourceUID]struct{}, len(importedUIDs))
	for _, uid := range importedUIDs {
		imported[uid] = struct{}{}
	}

	templates := make([]v1.TemplateGroup, 0, len(allTemplates))
	for _, tmpl := range allTemplates {
		if _, isImported := imported[tmpl.UID]; isImported {
			tmpl.Provenance = models.ProvenanceConvertedPrometheus
		} else {
			tmpl.Provenance = provenances[tmpl.ResourceID()]
		}
		templates = append(templates, tmpl)
	}

	// Sort templates by kind then name.
	return slices.SortedFunc(slices.Values(templates), func(a v1.TemplateGroup, b v1.TemplateGroup) int {
		return cmp.Or(
			cmp.Compare(a.Kind, b.Kind),
			cmp.Compare(a.Title, b.Title),
		)
	}), nil
}

func (t *TemplateService) GetTemplate(ctx context.Context, orgID int64, nameOrUid string) (v1.TemplateGroup, error) {
	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	result, found, err := t.getTemplateByName(ctx, revision, orgID, nameOrUid)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	if found {
		return result, nil
	}
	result, found, err = t.getTemplateByUID(ctx, revision, orgID, nameOrUid)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	if found {
		return result, nil
	}
	return v1.TemplateGroup{}, ErrTemplateNotFound.Errorf("")
}

// UpsertTemplate is used by the legacy provisioning API and matches by Name/Title only as the legacy provisioning API
// does not support UIDs.
func (t *TemplateService) UpsertTemplate(ctx context.Context, orgID int64, tmpl v1.TemplateGroup) (v1.TemplateGroup, error) {
	err := tmpl.Validate()
	if err != nil {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(err)
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	// Find the UID for the template with the given Title.
	existing, found, err := t.getTemplateByName(ctx, revision, orgID, tmpl.Title)
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	if found {
		// Update the existing template.
		tmpl.UID = existing.UID
		return t.updateTemplate(ctx, revision, orgID, tmpl)
	}

	// If template was not found, this is assumed to be a create operation except for two cases:
	// - If a ResourceVersion is provided: we should assume that this was meant to be a conditional update operation.
	// - If UID is provided: custom UID for templates is not currently supported, so this was meant to be an update
	// operation without a ResourceVersion.
	if tmpl.Version != "" || tmpl.UID != "" {
		return v1.TemplateGroup{}, ErrTemplateNotFound.Errorf("")
	}

	return t.createTemplate(ctx, revision, orgID, tmpl)
}

func (t *TemplateService) CreateTemplate(ctx context.Context, orgID int64, tmpl v1.TemplateGroup) (v1.TemplateGroup, error) {
	err := tmpl.Validate()
	if err != nil {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(err)
	}
	if tmpl.Kind == v1.TemplateKindMimir {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(errors.New("templates of kind 'Mimir' cannot be created"))
	}
	if err := t.validator(ctx, models.ProvenanceNone, tmpl.Provenance); err != nil {
		return v1.TemplateGroup{}, err
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	return t.createTemplate(ctx, revision, orgID, tmpl)
}

func (t *TemplateService) createTemplate(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, tmpl v1.TemplateGroup) (v1.TemplateGroup, error) {
	if tmpl.Kind == v1.TemplateKindMimir {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(errors.New("templates of kind 'Mimir' cannot be created"))
	}

	if revision.Config.Templates == nil {
		revision.Config.Templates = make(map[v1.ResourceUID]v1.TemplateGroup)
	}

	if revision.HasTemplateWithTitle(tmpl.Title) {
		return v1.TemplateGroup{}, ErrTemplateExists.Errorf("")
	}

	// Validate template limits before creating (check both count and size)
	if err := t.validateTemplateLimits(ctx, len(revision.Config.Templates), len(tmpl.Content), true); err != nil {
		return v1.TemplateGroup{}, err
	}

	created := revision.SetTemplate(tmpl)
	err := t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.SetProvenance(ctx, &created, orgID, created.Provenance)
	})
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	return created, nil
}

func (t *TemplateService) UpdateTemplate(ctx context.Context, orgID int64, tmpl v1.TemplateGroup) (v1.TemplateGroup, error) {
	err := tmpl.Validate()
	if err != nil {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(err)
	}

	revision, err := t.configStore.Get(ctx, orgID)
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	return t.updateTemplate(ctx, revision, orgID, tmpl)
}

func (t *TemplateService) updateTemplate(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, tmpl v1.TemplateGroup) (v1.TemplateGroup, error) {
	if revision.Config.Templates == nil {
		revision.Config.Templates = make(map[v1.ResourceUID]v1.TemplateGroup)
	}

	if tmpl.UID == "" {
		// Not sure if we should allow Updates from k8s API without a UID, but some existing tests indirectly verify this behaviour, so I'll leave it in for now.
		tmpl.UID = v1.TemplateUID(tmpl.Kind, tmpl.Title)
	}

	existing, found, err := t.getTemplateByUID(ctx, revision, orgID, string(tmpl.UID))
	if err != nil {
		return v1.TemplateGroup{}, err
	}
	if !found {
		return v1.TemplateGroup{}, ErrTemplateNotFound.Errorf("")
	}

	if existing.Title != tmpl.Title { // if template is renamed, check if this name is already taken
		if revision.HasTemplateWithTitle(tmpl.Title) {
			// return error if template is being renamed to one that already exists
			return v1.TemplateGroup{}, ErrTemplateExists.Errorf("")
		}
	}
	if existing.Kind != tmpl.Kind {
		return v1.TemplateGroup{}, MakeErrTemplateInvalid(errors.New("cannot change template kind"))
	}
	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return v1.TemplateGroup{}, makeErrTemplateOrigin(existing, "update")
	}
	if err := t.validator(ctx, existing.Provenance, tmpl.Provenance); err != nil {
		return v1.TemplateGroup{}, err
	}

	err = t.checkOptimisticConcurrency(existing, tmpl.Provenance, tmpl.Version, "update")
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	// Validate size limits before updating (count validation not needed for updates)
	if err := t.validateTemplateLimits(ctx, 0, len(tmpl.Content), false); err != nil {
		return v1.TemplateGroup{}, err
	}

	updated := revision.SetTemplate(tmpl)

	err = t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if existing.Title != updated.Title { // if template by was found by UID and it's name is different, then this is the rename operation. Delete old resources.
			// Remove old entry. This is only needed because UID is currently computed from the title.
			delete(revision.Config.Templates, existing.UID)
			err := t.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
			if err != nil {
				return err
			}
		}

		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.SetProvenance(ctx, &updated, orgID, updated.Provenance)
	})
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	return updated, nil
}

func (t *TemplateService) DeleteTemplate(ctx context.Context, orgID int64, nameOrUid string, provenance models.Provenance, version string) error {
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
	if existing.Provenance == models.ProvenanceConvertedPrometheus {
		return makeErrTemplateOrigin(existing, "delete")
	}

	err = t.checkOptimisticConcurrency(existing, provenance, version, "delete")
	if err != nil {
		return err
	}

	if err = t.validator(ctx, existing.Provenance, provenance); err != nil {
		return err
	}

	revision.DeleteTemplate(existing.UID)
	return t.xact.InTransaction(ctx, func(ctx context.Context) error {
		if err := t.configStore.Save(ctx, revision, orgID); err != nil {
			return err
		}
		return t.provenanceStore.DeleteProvenance(ctx, &existing, orgID)
	})
}

func (t *TemplateService) checkOptimisticConcurrency(existing v1.TemplateGroup, provenance models.Provenance, desiredVersion string, action string) error {
	if desiredVersion == "" {
		if provenance != models.ProvenanceFile {
			// if version is not specified and it's not a file provisioning, emit a log message to reflect that optimistic concurrency is disabled for this request
			t.log.Debug("ignoring optimistic concurrency check because version was not provided", "template", existing.Title, "operation", action)
		}
		return nil
	}
	currentVersion := v1.CalculateTemplateFingerprint(existing)
	if currentVersion != desiredVersion {
		return ErrVersionConflict.Errorf("provided version %s of template %s does not match current version %s", desiredVersion, existing.Title, currentVersion)
	}
	return nil
}

func (t *TemplateService) getTemplateByName(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, name string) (v1.TemplateGroup, bool, error) {
	existingContent, ok := revision.Config.Templates[v1.TemplateUID(v1.TemplateKindGrafana, name)]
	if !ok {
		return v1.TemplateGroup{}, false, nil
	}
	provenance, err := t.provenanceStore.GetProvenance(ctx, &existingContent, orgID)
	if err != nil {
		return v1.TemplateGroup{}, false, err
	}
	existingContent.Provenance = provenance
	return existingContent, true, nil
}

func (t *TemplateService) getTemplateByUID(ctx context.Context, revision *legacy_storage.ConfigRevision, orgID int64, uid string) (v1.TemplateGroup, bool, error) {
	if tmpl, ok := revision.Config.Templates[v1.ResourceUID(uid)]; ok {
		provenance, err := t.provenanceStore.GetProvenance(ctx, &tmpl, orgID)
		if err != nil {
			return v1.TemplateGroup{}, false, err
		}
		tmpl.Provenance = provenance
		return tmpl, true, nil
	}

	if t.includeImported && len(revision.Config.ExtraConfigs) > 0 {
		extraCfg := revision.Config.ExtraConfigs[0]
		// add Grafana templates to make sure the template UID does not conflict with it.
		merged, _, _, err := notifymerge.MergeTemplates(revision.Config.Templates, extraCfg.TemplateFiles, extraCfg.Identifier)
		if err != nil {
			return v1.TemplateGroup{}, false, err
		}
		if tmpl, ok := merged[v1.ResourceUID(uid)]; ok {
			tmpl.Provenance = models.ProvenanceConvertedPrometheus
			return tmpl, true, nil
		}
	}

	return v1.TemplateGroup{}, false, nil
}

// validateTemplateLimits checks if creating or updating a template would exceed configured limits.
// currentCount is the number of existing templates, templateSize is the size of the new template in bytes.
// checkCount indicates whether to validate the template count limit (should be true for create, false for update).
// Returns nil if limits are not configured, provider returns an error (fail-open), or the template is within limits.
func (t *TemplateService) validateTemplateLimits(ctx context.Context, currentCount int, templateSize int, checkCount bool) error {
	if t.limitsProvider == nil {
		return nil
	}

	limits, err := t.limitsProvider.GetLimits(ctx)
	if err != nil {
		t.log.Warn("Failed to fetch limits, skipping limit validation", "error", err)
		return nil
	}
	if limits == nil || limits.Templates == nil {
		return nil
	}

	// Check template count limit (0 means unlimited)
	if checkCount && limits.Templates.MaxTemplatesCount > 0 && currentCount >= limits.Templates.MaxTemplatesCount {
		return ErrTemplateLimitExceeded.Errorf("")
	}

	// Check template size limit (0 means unlimited)
	if limits.Templates.MaxTemplateSizeBytes > 0 && templateSize > limits.Templates.MaxTemplateSizeBytes {
		return ErrTemplateSizeExceeded.Errorf("")
	}

	return nil
}
