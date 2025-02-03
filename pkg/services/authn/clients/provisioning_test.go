package clients

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/stretchr/testify/assert"
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
			svc := ProvideProvisioning()

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

	svc := ProvideProvisioning()
	identity, err := svc.Authenticate(ctx, req)
	require.NoError(t, err, "Authenticate shouldn't err")

	assert.Equal(t, "auth.client.apiserver.provisioning", identity.UID, "UID")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.Login, "Login")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.Email, "Email")
	assert.Equal(t, "555", identity.ID, "ID")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.AuthenticatedBy, "AuthenticatedBy")
	assert.Equal(t, false, identity.GetIsGrafanaAdmin(), "IsAdmin")
}
