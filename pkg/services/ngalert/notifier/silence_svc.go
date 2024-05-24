package notifier

import (
	"context"
	"fmt"

	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
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
	HasAccessInFolder(ctx context.Context, user identity.Requester, rule accesscontrol.Namespaced) (bool, error)
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
	ListAlertRules(ctx context.Context, query *models.ListAlertRulesQuery) (models.RulesGroup, error)
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
func (s *SilenceService) GetSilence(ctx context.Context, user identity.Requester, silenceID string, withMetadata bool) (*models.SilenceWithMetadata, error) {
	silence, err := s.store.GetSilence(ctx, user.GetOrgID(), silenceID)
	if err != nil {
		return nil, err
	}

	if err := s.authz.AuthorizeReadSilence(ctx, user, silence); err != nil {
		return nil, err
	}

	if withMetadata {
		if silencesWithMetadata, err := s.WithMetadata(ctx, user, silence); err == nil && len(silencesWithMetadata) == 1 {
			return silencesWithMetadata[0], nil
		}
		s.log.Error("failed to get silence metadata", "silenceID", silenceID, "error", err)
	}

	return &models.SilenceWithMetadata{
		Silence: silence,
	}, nil
}

// ListSilences retrieves all silences that match the given filter. This will include all rule-specific silences that
// the user has access to as well as all general silences.
func (s *SilenceService) ListSilences(ctx context.Context, user identity.Requester, filter []string, withMetadata bool) ([]*models.SilenceWithMetadata, error) {
	silences, err := s.store.ListSilences(ctx, user.GetOrgID(), filter)
	if err != nil {
		return nil, err
	}

	filtered, err := s.authz.FilterByAccess(ctx, user, silences...)
	if err != nil {
		return nil, err
	}

	if withMetadata {
		if silencesWithMetadata, err := s.WithMetadata(ctx, user, filtered...); err != nil {
			s.log.Error("failed to get silences metadata", "error", err)
		} else {
			return silencesWithMetadata, nil
		}
	}
	return withNoMetadata(filtered...), nil
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
	silence, err := s.GetSilence(ctx, user, silenceID, false)
	if err != nil {
		return err
	}

	if err := s.authz.AuthorizeUpdateSilence(ctx, user, silence.Silence); err != nil {
		return err
	}

	err = s.store.DeleteSilence(ctx, user.GetOrgID(), silenceID)
	if err != nil {
		return err
	}

	return nil
}

func (s *SilenceService) WithMetadata(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.SilenceWithMetadata, error) {
	permissions, err := s.authz.SilenceAccess(ctx, user, silences)
	if err != nil {
		return nil, err
	}

	if len(permissions) != len(silences) {
		return nil, fmt.Errorf("failed to get metadata for all silences")
	}

	silencesWithMetadata := make([]*models.SilenceWithMetadata, 0, len(silences))
	for _, silence := range silences {
		silencesWithMetadata = append(silencesWithMetadata, &models.SilenceWithMetadata{
			Silence: silence,
			Metadata: &models.SilenceMetadata{
				Permissions: permissions[silence],
			},
		})
	}

	return s.addRuleMetadata(ctx, user, silencesWithMetadata...)
}

func (s *SilenceService) addRuleMetadata(ctx context.Context, user identity.Requester, silences ...*models.SilenceWithMetadata) ([]*models.SilenceWithMetadata, error) {
	byRuleUID := make(map[string][]*models.SilenceWithMetadata, len(silences))
	for _, silence := range silences {
		ruleUID := silence.GetRuleUID()
		if ruleUID != nil {
			byRuleUID[*ruleUID] = append(byRuleUID[*ruleUID], silence)
		}
	}

	if len(byRuleUID) == 0 {
		return silences, nil
	}

	q := models.ListAlertRulesQuery{
		RuleUIDs: maps.Keys(byRuleUID),
		OrgID:    user.GetOrgID(),
	}

	rules, err := s.ruleStore.ListAlertRules(ctx, &q)
	if err != nil {
		return nil, err
	}

	accessCacheByFolder := make(map[string]bool)
	for _, rule := range rules {
		// TODO: Preferably silence service should not need to know about the internal details of rule access control.
		// This can be improved by adding a method to ruleAuthz that does the filtering itself or a method that exposes
		// an access fingerprint for a rule that callers can use to do their own caching.
		fp := rule.NamespaceUID
		if canAccess, ok := accessCacheByFolder[fp]; ok && !canAccess {
			continue
		}

		canAccess, err := s.ruleAuthz.HasAccessInFolder(ctx, user, rule)
		if err == nil {
			accessCacheByFolder[fp] = canAccess // Only cache if there is no error.
		}
		if err != nil || !canAccess {
			continue // Assume no access if there is an error.
		}

		if ruleSilences, ok := byRuleUID[rule.UID]; ok {
			for _, sil := range ruleSilences {
				if sil.Metadata == nil {
					sil.Metadata = &models.SilenceMetadata{}
				}
				sil.Metadata.RuleUID = rule.UID
				sil.Metadata.RuleTitle = rule.Title
				sil.Metadata.FolderUID = rule.NamespaceUID
			}
		}
	}

	return silences, nil
}

func withNoMetadata(silences ...*models.Silence) []*models.SilenceWithMetadata {
	silencesWithMetadata := make([]*models.SilenceWithMetadata, 0, len(silences))
	for _, silence := range silences {
		silencesWithMetadata = append(silencesWithMetadata, &models.SilenceWithMetadata{
			Silence: silence,
		})
	}
	return silencesWithMetadata
}
