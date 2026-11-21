package datasource

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Query types are cluster-scoped, so these requests carry no namespace. The
// real access client rejects that for a caller bound to one namespace, which a
// unit test with a fake client cannot show.
func TestIntegrationDatasourceQueryTypes(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, // Required to start the datasource api servers
			featuremgmt.FlagDatasourceUseNewCRUDAPIs,             // registers the datasource api groups
			featuremgmt.FlagDatasourcesQueryTypes,                // registers the querytypes resource
		},
	})
	t.Cleanup(helper.Shutdown)

	const root = "/apis/grafana-testdata-datasource.datasource.grafana.app/v0alpha1/querytypes"

	type queryTypeList struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
		} `json:"items"`
	}

	for name, user := range map[string]apis.User{
		"admin":  helper.Org1.Admin,
		"viewer": helper.Org1.Viewer,
	} {
		t.Run(name+" can list, get and validate", func(t *testing.T) {
			list := apis.DoRequest(helper, apis.RequestParams{
				User:   user,
				Method: http.MethodGet,
				Path:   root,
			}, &queryTypeList{})
			require.Equal(t, http.StatusOK, list.Response.StatusCode, string(list.Body))
			require.NotEmpty(t, list.Result.Items)

			get := apis.DoRequest[any](helper, apis.RequestParams{
				User:   user,
				Method: http.MethodGet,
				Path:   root + "/" + list.Result.Items[0].Metadata.Name,
			}, nil)
			require.Equal(t, http.StatusOK, get.Response.StatusCode, string(get.Body))

			// The authorizer allows validate only for the create verb, so this
			// depends on the apiserver mapping a POST on the connect subresource
			// to create.
			validate := apis.DoRequest[any](helper, apis.RequestParams{
				User:   user,
				Method: http.MethodPost,
				Path:   root + "/" + list.Result.Items[0].Metadata.Name + "/validate",
				Body:   []byte(`{}`),
			}, nil)
			require.Equal(t, http.StatusOK, validate.Response.StatusCode, string(validate.Body))
		})
	}

	t.Run("delete is forbidden", func(t *testing.T) {
		rsp := apis.DoRequest[any](helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   root + "/anything",
		}, nil)
		require.Equal(t, http.StatusForbidden, rsp.Response.StatusCode, string(rsp.Body))
	})
}
