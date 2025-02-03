package clients

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestProvisioning_Test(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	for _, tt := range []struct {
		Name, URL string
		Valid     bool
	}{
		{"Root path is invalid", "https://grafana.localhost/", false},
		{"Non-provisioning path", "https://grafana.localhost/hello/world", false},
		{"Provisioning path that isn't webhook", "https://grafana.localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/x/repositories/y/unittest", false},
		{"Webhook path", "https://grafana.localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/x/repositories/y/webhook", true},
		{"Webhook path with subpath", "https://grafana.localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/x/repositories/y/webhook/unittest", false}, // this'll have to change if we ever want subpaths
	} {
		t.Run(tt.Name, func(t *testing.T) {
			t.Parallel()
			userSvc := usertest.NewMockService(t)
			svc := ProvideProvisioning(userSvc)

			url, err := url.Parse(tt.URL)
			require.NoError(t, err, "couldn't parse input URL")
			req := &authn.Request{HTTPRequest: &http.Request{
				URL: url,
			}}

			assert.Equal(t, tt.Valid, svc.Test(ctx, req))
		})
	}
}

func TestProvisioning_Authenticate(t *testing.T) {
	t.Parallel()
	ctx := context.Background()

	url, err := url.Parse("https://grafana.localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/x/repositories/y/webhook")
	require.NoError(t, err, "couldn't parse URL known to be good?")
	req := &authn.Request{HTTPRequest: &http.Request{
		URL: url,
	}}

	t.Run("SA exists", func(t *testing.T) {
		t.Parallel()
		userSvc := usertest.NewMockService(t)
		userSvc.On("GetByUID", mock.Anything, mock.Anything).
			Return(&user.User{
				ID:    555,
				UID:   "auth.client.apiserver.provisioning",
				Login: "auth.client.apiserver.provisioning",
				Email: "auth.client.apiserver.provisioning",
			}, nil)
		// Shouldn't call CreateServiceAccount, so we're not setting it up

		svc := ProvideProvisioning(userSvc)
		identity, err := svc.Authenticate(ctx, req)
		require.NoError(t, err, "Authenticate shouldn't err")

		assert.Equal(t, "auth.client.apiserver.provisioning", identity.UID, "UID")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.Login, "Login")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.Email, "Email")
		assert.Equal(t, "555", identity.ID, "ID")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.AuthenticatedBy, "AuthenticatedBy")
		assert.Equal(t, false, identity.GetIsGrafanaAdmin(), "IsAdmin")

		assert.Equal(t, "auth.client.apiserver.provisioning", userSvc.Calls[0].Arguments[1].(*user.GetUserByUIDQuery).UID, "requested UID should be the client name")
	})

	t.Run("SA must be created", func(t *testing.T) {
		t.Parallel()
		userSvc := usertest.NewMockService(t)
		getByUID := userSvc.On("GetByUID", mock.Anything, mock.Anything).
			Return(nil, user.ErrUserNotFound)
		userSvc.On("CreateServiceAccount", mock.Anything, mock.Anything).
			Return(&user.User{
				ID:    555,
				UID:   "auth.client.apiserver.provisioning",
				Login: "auth.client.apiserver.provisioning",
				Email: "auth.client.apiserver.provisioning",
			}, nil).
			NotBefore(getByUID)

		svc := ProvideProvisioning(userSvc)
		identity, err := svc.Authenticate(ctx, req)
		require.NoError(t, err, "Authenticate shouldn't err")

		assert.Equal(t, "auth.client.apiserver.provisioning", identity.UID, "UID")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.Login, "Login")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.Email, "Email")
		assert.Equal(t, "555", identity.ID, "ID")
		assert.Equal(t, "auth.client.apiserver.provisioning", identity.AuthenticatedBy, "AuthenticatedBy")
		assert.Equal(t, false, identity.GetIsGrafanaAdmin(), "IsAdmin")

		assert.Equal(t, "auth.client.apiserver.provisioning", userSvc.Calls[0].Arguments[1].(*user.GetUserByUIDQuery).UID, "requested UID should be the client name")
		cmd := userSvc.Calls[1].Arguments[1].(*user.CreateUserCommand)
		assert.Equal(t, "auth.client.apiserver.provisioning", cmd.UID, "created UID should be the client name")
		assert.Equal(t, "auth.client.apiserver.provisioning", cmd.Name, "created Name should be the client name")
		assert.Equal(t, "auth.client.apiserver.provisioning", cmd.Login, "created Login should be the client name")
		assert.True(t, cmd.IsServiceAccount, "created IsServiceAccount")
		assert.False(t, cmd.IsAdmin, "created IsAdmin")
	})

	t.Run("GetByUID returns error", func(t *testing.T) {
		t.Parallel()
		userSvc := usertest.NewMockService(t)
		expectedErr := errors.New("database is broken!")
		userSvc.On("GetByUID", mock.Anything, mock.Anything).
			Return(nil, expectedErr)

		svc := ProvideProvisioning(userSvc)
		_, err := svc.Authenticate(ctx, req)
		require.ErrorIs(t, err, expectedErr, "Authenticate should propagate error")
	})

	t.Run("CreateServiceAccount returns error", func(t *testing.T) {
		t.Parallel()
		userSvc := usertest.NewMockService(t)
		expectedErr := errors.New("database is broken!")
		userSvc.On("GetByUID", mock.Anything, mock.Anything).
			Return(nil, user.ErrUserNotFound)
		userSvc.On("CreateServiceAccount", mock.Anything, mock.Anything).
			Return(nil, expectedErr)

		svc := ProvideProvisioning(userSvc)
		_, err := svc.Authenticate(ctx, req)
		require.ErrorIs(t, err, expectedErr, "Authenticate should propagate error")
	})
}
