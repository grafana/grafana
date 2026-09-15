package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeSilenceService struct {
	FilterByAccessFunc         func(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.Silence, error)
	AuthorizeReadSilenceFunc   func(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeCreateSilenceFunc func(ctx context.Context, user identity.Requester, silence *models.Silence) error
	AuthorizeUpdateSilenceFunc func(ctx context.Context, user identity.Requester, silence *models.Silence) error
	SilenceAccessFunc          func(ctx context.Context, user identity.Requester, silences []*models.Silence) (map[*models.Silence]models.SilencePermissionSet, error)

	Calls []Call
}

func (s *FakeSilenceService) FilterByAccess(ctx context.Context, user identity.Requester, silences ...*models.Silence) ([]*models.Silence, error) {
	s.Calls = append(s.Calls, Call{"FilterByAccess", []any{ctx, user, silences}})
	if s.FilterByAccessFunc != nil {
		return s.FilterByAccessFunc(ctx, user, silences...)
	}
	return nil, nil
}

func (s *FakeSilenceService) AuthorizeReadSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadSilence", []any{ctx, user, silence}})
	if s.AuthorizeReadSilenceFunc != nil {
		return s.AuthorizeReadSilenceFunc(ctx, user, silence)
	}
	return nil
}

func (s *FakeSilenceService) AuthorizeCreateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	s.Calls = append(s.Calls, Call{"AuthorizeCreateSilence", []any{ctx, user, silence}})
	if s.AuthorizeCreateSilenceFunc != nil {
		return s.AuthorizeCreateSilenceFunc(ctx, user, silence)
	}
	return nil
}

func (s *FakeSilenceService) AuthorizeUpdateSilence(ctx context.Context, user identity.Requester, silence *models.Silence) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdateSilence", []any{ctx, user, silence}})
	if s.AuthorizeUpdateSilenceFunc != nil {
		return s.AuthorizeUpdateSilenceFunc(ctx, user, silence)
	}
	return nil
}

func (s *FakeSilenceService) SilenceAccess(ctx context.Context, user identity.Requester, silences []*models.Silence) (map[*models.Silence]models.SilencePermissionSet, error) {
	s.Calls = append(s.Calls, Call{"SilenceAccess", []any{ctx, user, silences}})
	if s.SilenceAccessFunc != nil {
		return s.SilenceAccessFunc(ctx, user, silences)
	}
	return nil, nil
}
