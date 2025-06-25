package notifier

import (
	"context"

	"golang.org/x/exp/maps"

	alertingModels "github.com/grafana/alerting/models"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// SilenceService is the authenticated service for managing alertmanager silences.
type SilenceService struct {
	authz     SilenceAccessControlService
	xact      transactionManager
	log       log.Logger
	store     SilenceStore
	ruleStore RuleStore
	ruleAuthz RuleAccessControlService
}

type RuleAccessControlService interface {
	HasAccessInFolder(ctx context.Context, user identity.Requester, rule models.Namespaced) (bool, error)
}

// SilenceAccessControlService provides access control for silences.
type SilenceAccessControlService interface {
	FilterByAccess(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.Silence, error)
	AuthorizeReadSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeCreateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeUpdateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
	SilenceAccess(ctx context.Context, user identity.Requester, silences []*models.Silence) (map[*models.Silence]models.SilencePermissionSet, error)
}

// SilenceStore is the interface for storing and retrieving silences. Currently, this is implemented by
// MultiOrgAlertmanager but should eventually be replaced with an actual store.
type SilenceStore interface {
	ListSilences(ctx context.Context, orgID int64, filter []string) ([]*models.Silence, error)
	GetSilence(ctx context.Context, orgID int64, id string) (*models.Silence, error)
	CreateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error)
	UpdateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error)
	DeleteSilence(ctx context.Context, orgID int64, id string) error
}

type RuleStore interface {
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) (models.RulesGroup, string, error)
}

func NewSilenceService(
	authz SilenceAccessControlService,
	xact transactionManager,
	log log.Logger,
	store SilenceStore,
	ruleStore RuleStore,
	ruleAuthz RuleAccessControlService,
) *SilenceService {
	return &SilenceService{
		authz:     authz,
		xact:      xact,
		log:       log,
		store:     store,
		ruleStore: ruleStore,
		ruleAuthz: ruleAuthz,
	}
}

// GetSilence retrieves a silence by its ID.
func (s *SilenceService) GetSilence(ctx context.Context, user identity.Requester, silenceID string) (*models.Silence, error) {
	silence, err := s.store.GetSilence(ctx, user.GetOrgID(), silenceID)
	if err != nil {
		return nil, err
	}

	if err := s.authz.AuthorizeReadSilence(ctx, user, silence); err != nil {
		return nil, err
	}

	return silence, nil
}

// ListSilences retrieves all silences that match the given filter. This will include all rule-specific silences that
// the user has access to as well as all general silences.
func (s *SilenceService) ListSilences(ctx context.Context, user identity.Requester, filter []string) ([]*models.Silence, error) {
	silences, err := s.store.ListSilences(ctx, user.GetOrgID(), filter)
	if err != nil {
		return nil, err
	}

	return s.authz.FilterByAccess(ctx, user, silences...)
}

// CreateSilence creates a new silence.
// For rule-specific silences, the user needs permission to create silences in the folder that the associated rule is in.
// For general silences, the user needs broader permissions.
func (s *SilenceService) CreateSilence(ctx context.Context, user identity.Requester, ps models.Silence) (string, error) {
	if err := s.authz.AuthorizeCreateSilence(ctx, user, &ps); err != nil {
		return "", err
	}

	silenceId, err := s.store.CreateSilence(ctx, user.GetOrgID(), ps)
	if err != nil {
		return "", err
	}

	return silenceId, nil
}

// UpdateSilence updates an existing silence.
// For rule-specific silences, the user needs permission to update silences in the folder that the associated rule is in.
// For general silences, the user needs broader permissions.
func (s *SilenceService) UpdateSilence(ctx context.Context, user identity.Requester, ps models.Silence) (string, error) {
	if err := s.authz.AuthorizeUpdateSilence(ctx, user, &ps); err != nil {
		return "", err
	}

	existing, err := s.store.GetSilence(ctx, user.GetOrgID(), *ps.ID)
	if err != nil {
		return "", err
	}

	if err := validateSilenceUpdate(existing, ps); err != nil {
		return "", err
	}

	silenceId, err := s.store.UpdateSilence(ctx, user.GetOrgID(), ps)
	if err != nil {
		return "", err
	}

	return silenceId, nil
}

// DeleteSilence deletes a silence by its ID.
// For rule-specific silences, the user needs permission to update silences in the folder that the associated rule is in.
// For general silences, the user needs broader permissions.
func (s *SilenceService) DeleteSilence(ctx context.Context, user identity.Requester, silenceID string) error {
	silence, err := s.GetSilence(ctx, user, silenceID)
	if err != nil {
		return err
	}

	if err := s.authz.AuthorizeUpdateSilence(ctx, user, silence); err != nil {
		return err
	}

	err = s.store.DeleteSilence(ctx, user.GetOrgID(), silenceID)
	if err != nil {
		return err
	}

	return nil
}

// WithAccessControlMetadata adds access control metadata to the given SilenceWithMetadata.
func (s *SilenceService) WithAccessControlMetadata(ctx context.Context, user identity.Requester, silencesWithMetadata ...*models.SilenceWithMetadata) error {
	silences := make([]*models.Silence, 0, len(silencesWithMetadata))
	for _, silence := range silencesWithMetadata {
		silences = append(silences, silence.Silence)
	}
	permissions, err := s.authz.SilenceAccess(ctx, user, silences)
	if err != nil {
		return err
	}

	if len(permissions) != len(silences) {
		s.log.Warn("failed to get metadata for all silences")
	}

	for _, silence := range silencesWithMetadata {
		if perms, ok := permissions[silence.Silence]; ok {
			silence.Metadata.Permissions = &perms
		}
	}

	return nil
}

// WithRuleMetadata adds rule metadata to the given SilenceWithMetadata.
func (s *SilenceService) WithRuleMetadata(ctx context.Context, user identity.Requester, silences ...*models.SilenceWithMetadata) error {
	byRuleUID := make(map[string][]*models.SilenceWithMetadata, len(silences))
	for _, silence := range silences {
		ruleUID := silence.GetRuleUID()
		if ruleUID != nil {
			byRuleUID[*ruleUID] = append(byRuleUID[*ruleUID], silence)
			silence.Metadata.RuleMetadata = &models.SilenceRuleMetadata{ // Attach metadata with rule UID regardless of access.
				RuleUID: *ruleUID,
			}
		}
	}

	if len(byRuleUID) == 0 {
		return nil
	}

	q := models.ListAlertRulesQuery{
		RuleUIDs: maps.Keys(byRuleUID),
		OrgID:    user.GetOrgID(),
	}

	rules, _, err := s.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return err
	}

	accessCacheByFolder := make(map[string]bool)
	for _, rule := range rules {
		// TODO: Preferably silence service should not need to know about the internal details of rule access control.
		// This can be improved by adding a method to ruleAuthz that does the filtering itself or a method that exposes
		// an access fingerprint for a rule that callers can use to do their own caching.
		fp := rule.NamespaceUID
		canAccess, ok := accessCacheByFolder[fp]
		if !ok {
			var err error
			if canAccess, err = s.ruleAuthz.HasAccessInFolder(ctx, user, rule); err != nil {
				continue // Assume no access if there is an error but don't cache.
			}
			accessCacheByFolder[fp] = canAccess // Only cache if there is no error.
		}
		if !canAccess {
			continue
		}

		if ruleSilences, ok := byRuleUID[rule.UID]; ok {
			for _, sil := range ruleSilences {
				if sil.Metadata.RuleMetadata == nil {
					sil.Metadata.RuleMetadata = &models.SilenceRuleMetadata{}
				}
				sil.Metadata.RuleMetadata.RuleTitle = rule.Title
				sil.Metadata.RuleMetadata.FolderUID = rule.NamespaceUID
			}
		}
	}

	return nil
}

// validateSilenceUpdate validates the diff between an existing silence and a new silence. Currently, this is use to
// prevent changing the rule UID matcher.
// Alternatively, we could check WRITE permission on the old silence followed by CREATE permission on the new silence
// if the rule folder is different.
func validateSilenceUpdate(existing *models.Silence, new models.Silence) error {
	existingRuleUID := existing.GetRuleUID()
	newRuleUID := new.GetRuleUID()
	if existingRuleUID == nil || newRuleUID == nil {
		if existingRuleUID != newRuleUID {
			return WithPublicError(ErrSilencesBadRequest.Errorf("Silence rule matcher '%s' cannot be updated, please create a new silence", alertingModels.RuleUIDLabel))
		}
	} else if *existingRuleUID != *newRuleUID {
		return WithPublicError(ErrSilencesBadRequest.Errorf("Silence rule matcher '%s' cannot be updated, please create a new silence", alertingModels.RuleUIDLabel))
	}

	return nil
}
