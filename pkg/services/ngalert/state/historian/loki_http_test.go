package historian

import (
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
)

// This function can be used for local testing, just remove the skip call.
func TestLokiHTTPClient(t *testing.T) {

	t.Skip()

	url, err := url.Parse("https://logs-prod-eu-west-0.grafana.net")
	require.NoError(t, err)

	client := newLokiClient(LokiConfig{
		Url: url,
	}, log.NewNopLogger())

	// Unauthorized request should fail against Grafana Cloud.
	err = client.ping()
	require.Error(t, err)

	client.cfg.TenantID = "<your_tenant_id>"
	client.cfg.TenantPassword = "<your_password>"

	// Authorized request should fail against Grafana Cloud.
	err = client.ping()
	require.NoError(t, err)
}
