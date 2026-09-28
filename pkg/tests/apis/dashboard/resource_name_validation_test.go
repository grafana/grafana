package dashboards

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDashboardGetNameValidation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, sqlKV := range []bool{false, true} {
		t.Run(fmt.Sprintf("sqlkv=%t", sqlKV), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:   true,
				EnableSQLKVBackend: sqlKV,
			})
			t.Cleanup(helper.Shutdown)

			tests := []struct {
				name       string
				value      string
				statusCode int
			}{
				{name: "spaces and parentheses", value: "Player Resolver (ext_proc)", statusCode: http.StatusBadRequest},
				{name: "too long", value: strings.Repeat("a", 254), statusCode: http.StatusBadRequest},
				{name: "percent", value: "invalid%name", statusCode: http.StatusBadRequest},
				{name: "valid missing name", value: "123_valid-missing-name", statusCode: http.StatusNotFound},
				{name: "valid punctuation", value: "missing.name:with-punctuation", statusCode: http.StatusNotFound},
				{name: "maximum length", value: strings.Repeat("a", 253), statusCode: http.StatusNotFound},
			}
			for _, version := range []string{"v0alpha1", "v1beta1", "v1", "v2alpha1", "v2beta1", "v2"} {
				t.Run(version, func(t *testing.T) {
					for _, suffix := range []string{"", "/dto"} {
						t.Run("get"+suffix, func(t *testing.T) {
							for _, tt := range tests {
								t.Run(tt.name, func(t *testing.T) {
									rsp := apis.DoRequest(helper, apis.RequestParams{
										User: helper.Org1.Admin,
										Path: fmt.Sprintf("/apis/dashboard.grafana.app/%s/namespaces/%s/dashboards/%s%s",
											version, helper.Namespacer(helper.Org1.OrgID), url.PathEscape(tt.value), suffix),
									}, &metav1.Status{})
									require.Equal(t, tt.statusCode, rsp.Response.StatusCode, string(rsp.Body))
									require.NotNil(t, rsp.Status)
									require.Equal(t, int32(tt.statusCode), rsp.Status.Code)
									if tt.statusCode == http.StatusBadRequest {
										require.Equal(t, metav1.StatusReasonBadRequest, rsp.Status.Reason)
										require.Contains(t, rsp.Status.Message, tt.value)
									} else {
										require.Equal(t, metav1.StatusReasonNotFound, rsp.Status.Reason)
									}
								})
							}
						})
					}
				})
			}
		})
	}
}
