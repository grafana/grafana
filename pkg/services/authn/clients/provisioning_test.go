package clients

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/authn"
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
		{"Render image url", "https://grafana.localhost/apis/provisioning.grafana.app/v0alpha1/namespaces/x/repositories/y/render/image-uid", true},
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

	assert.Equal(t, types.TypeAnonymous, identity.GetIdentityType(), "IdentityType")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.UID, "UID")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.Login, "Login")
	assert.Equal(t, "auth.client.apiserver.provisioning", identity.AuthenticatedBy, "AuthenticatedBy")
	assert.Equal(t, false, identity.GetIsGrafanaAdmin(), "IsAdmin")
}

func TestProvisioning_Assumptions(t *testing.T) {
	t.Run("APIVERSION constant has no leading or trailing slashes", func(t *testing.T) {
		assert.False(t, strings.HasPrefix(provisioning.APIVERSION, "/"), "found leading / in APIVERSION: %s", provisioning.APIVERSION)
		assert.False(t, strings.HasSuffix(provisioning.APIVERSION, "/"), "found trailing / in APIVERSION: %s", provisioning.APIVERSION)
	})
}
