package alerting

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationProvisioning(t *testing.T) {
	testinfra.SQLiteIntegrationTest(t)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableLegacyAlerting: true,
		EnableUnifiedAlerting: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
	})

	grafanaListedAddr, store := testinfra.StartGrafana(t, dir, path)

	// Create a users to make authenticated requests
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleViewer),
		Password:       "viewer",
		Login:          "viewer",
	})
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleEditor),
		Password:       "editor",
		Login:          "editor",
	})
	createUser(t, store, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	t.Run("when provisioning notification policies", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/policies", grafanaListedAddr)
		body := `
		{
			"receiver": "test-receiver",
			"group_by": [
				"..."
			],
			"routes": []
		}`

		// As we check if the receiver exists that is referenced in the policy,
		// we first need to create it, so the tests passes correctly.
		urlReceiver := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		bodyReceiver := `
		{
			"name": "test-receiver",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		req := createTestRequest("POST", urlReceiver, "admin", bodyReceiver)
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		require.Equal(t, 202, resp.StatusCode)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated PUT should 401", func(t *testing.T) {
			req := createTestRequest("PUT", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer PUT should 403", func(t *testing.T) {
			req := createTestRequest("PUT", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor PUT should 403", func(t *testing.T) {
			req := createTestRequest("PUT", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin PUT should succeed", func(t *testing.T) {
			req := createTestRequest("PUT", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())
			require.Equal(t, 202, resp.StatusCode)
		})
	})

	t.Run("when provisioning contactpoints", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/contact-points", grafanaListedAddr)
		body := `
		{
			"name": "my-contact-point",
			"type": "slack",
			"settings": {
				"recipient": "value_recipient",
				"token": "value_token"
			}
		}`

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})

		t.Run("un-authenticated POST should 401", func(t *testing.T) {
			req := createTestRequest("POST", url, "", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer POST should 403", func(t *testing.T) {
			req := createTestRequest("POST", url, "viewer", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor POST should 403", func(t *testing.T) {
			req := createTestRequest("POST", url, "editor", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin POST should succeed", func(t *testing.T) {
			req := createTestRequest("POST", url, "admin", body)

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 202, resp.StatusCode)
		})
	})

	t.Run("when provisioning templates", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/templates", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})

	t.Run("when provisioning mute timings", func(t *testing.T) {
		url := fmt.Sprintf("http://%s/api/v1/provisioning/mute-timings", grafanaListedAddr)

		t.Run("un-authenticated GET should 401", func(t *testing.T) {
			req := createTestRequest("GET", url, "", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 401, resp.StatusCode)
		})

		t.Run("viewer GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "viewer", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("editor GET should 403", func(t *testing.T) {
			req := createTestRequest("GET", url, "editor", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 403, resp.StatusCode)
		})

		t.Run("admin GET should succeed", func(t *testing.T) {
			req := createTestRequest("GET", url, "admin", "")

			resp, err := http.DefaultClient.Do(req)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			require.Equal(t, 200, resp.StatusCode)
		})
	})
}

func createTestRequest(method string, url string, user string, body string) *http.Request {
	var bodyBuf io.Reader
	if body != "" {
		bodyBuf = bytes.NewReader([]byte(body))
	}
	req, _ := http.NewRequest(method, url, bodyBuf)
	if bodyBuf != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if user != "" {
		req.SetBasicAuth(user, user)
	}
	return req
}
