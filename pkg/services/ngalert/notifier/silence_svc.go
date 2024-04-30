package notifier

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// SilenceService is the authenticated service for managing alertmanager silences.
type SilenceService struct {
	authz SilenceAccessControlService
	xact  transactionManager
	log   log.Logger
	store SilenceStore
}

// SilenceAccessControlService provides access control for silences.
type SilenceAccessControlService interface {
	FilterByAccess(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.Silence, error)
	AuthorizeReadSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeCreateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeUpdateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error
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

func NewSilenceService(
	authz SilenceAccessControlService,
	xact transactionManager,
	log log.Logger,
	store SilenceStore,
) *SilenceService {
	return &SilenceService{
		authz: authz,
		xact:  xact,
		log:   log,
		store: store,
	}
}

// GetSilence retrieves a silence by its ID.
func (s *SilenceService) GetSilence(ctx context.Context, user identity.Requester, silenceID string) (*models.Silence, error) {
	gettableSilence, err := s.store.GetSilence(ctx, user.GetOrgID(), silenceID)
	if err != nil {
		return nil, err
	}

	if err := s.authz.AuthorizeReadSilence(ctx, user, gettableSilence); err != nil {
		return nil, err
	}

	return gettableSilence, nil
}

// ListSilences retrieves all silences that match the given filter. This will include all rule-specific silences that
// the user has access to as well as all general silences.
func (s *SilenceService) ListSilences(ctx context.Context, user identity.Requester, filter []string) ([]*models.Silence, error) {
	gettableSilences, err := s.store.ListSilences(ctx, user.GetOrgID(), filter)
	if err != nil {
		return nil, err
	}

	return s.authz.FilterByAccess(ctx, user, gettableSilences...)
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
