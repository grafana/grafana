package alerting

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

const defaultAlertmanagerConfigJSON = `
{
	"template_files": null,
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"templates": null,
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"id": 0,
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"isDefault": true,
				"sendReminder": false,
				"disableResolveMessage": false,
				"frequency": "",
				"created": "0001-01-01T00:00:00Z",
				"updated": "0001-01-01T00:00:00Z",
				"settings": {
					"addresses": "\u003cexample@email.com\u003e"
				},
				"secureFields": {}
			}]
		}]
	}
}
`

func getRequest(t *testing.T, url string, expStatusCode int) *http.Response {
	t.Helper()
	// nolint:gosec
	resp, err := http.Get(url)
	t.Cleanup(func() {
		require.NoError(t, resp.Body.Close())
	})
	require.NoError(t, err)
	if expStatusCode != resp.StatusCode {
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		t.Fatal(string(b))
	}
	return resp
}

func postRequest(t *testing.T, url string, body string, expStatusCode int) *http.Response {
	t.Helper()
	buf := bytes.NewReader([]byte(body))
	// nolint:gosec
	resp, err := http.Post(url, "application/json", buf)
	t.Cleanup(func() {
		require.NoError(t, resp.Body.Close())
	})
	require.NoError(t, err)
	if expStatusCode != resp.StatusCode {
		b, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		t.Fatal(string(b))
	}
	return resp
}

func getBody(t *testing.T, body io.ReadCloser) string {
	t.Helper()
	b, err := ioutil.ReadAll(body)
	require.NoError(t, err)
	return string(b)
}
