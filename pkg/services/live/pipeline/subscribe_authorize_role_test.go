package pipeline

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/live/livecontext"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestAuthorizeRoleSubscriber_Subscribe_PermissionDenied(t *testing.T) {
	ctx := context.Background()
	ctx = livecontext.SetContextSignedUser(ctx, &models.SignedInUser{OrgRole: models.ROLE_EDITOR})
	s := NewAuthorizeRoleSubscriber(AuthorizeRoleSubscriberConfig{
		Role: models.ROLE_ADMIN,
	})
	_, status, err := s.Subscribe(ctx, Vars{})
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusPermissionDenied, status)
}

func TestAuthorizeRoleSubscriber_Subscribe_OK(t *testing.T) {
	ctx := context.Background()
	ctx = livecontext.SetContextSignedUser(ctx, &models.SignedInUser{OrgRole: models.ROLE_ADMIN})
	s := NewAuthorizeRoleSubscriber(AuthorizeRoleSubscriberConfig{
		Role: models.ROLE_ADMIN,
	})
	_, status, err := s.Subscribe(ctx, Vars{})
	require.NoError(t, err)
	require.Equal(t, backend.SubscribeStreamStatusOK, status)
}
