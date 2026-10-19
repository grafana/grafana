package authn

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAPIGroupFromRequest(t *testing.T) {
	for target, want := range map[string]string{
		"/apis/iam.grafana.app/v0alpha1/whoami":         "iam.grafana.app",
		"/apis/folder.grafana.app":                      "folder.grafana.app",
		"/apis/folder.grafana.app/":                     "folder.grafana.app",
		"/apis/appsdktest.ext.grafana.app/v1alpha1/foo": "appsdktest.ext.grafana.app",
		"/apis":                "",
		"/apis/":               "",
		"/apis/example-app/v1": "",
		"/api/user":            "",
		"/api/plugins/example-app/resources/apis/x.y.z/foo":  "",
		"/openapi/v3/apis/iam.grafana.app/v0alpha1":          "",
		"/apis/iam.grafana.app/../folder.grafana.app/v1":     "",
		"/apis/iam.grafana.app/%2e%2e/folder.grafana.app/v1": "",
		"/apis/iam.grafana.app//v1":                          "",
		"/apis/iam.grafana.app%2fv1":                         "",
		"/apis/./v1":                                         "",
		"/apis/../v1":                                        "",
	} {
		t.Run(target, func(t *testing.T) {
			require.Equal(t, want, apiGroupFromRequest(httptest.NewRequest(http.MethodGet, target, nil)))
		})
	}
	require.Empty(t, apiGroupFromRequest(&http.Request{}))
	require.Empty(t, apiGroupFromRequest(nil))
}
