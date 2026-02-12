package integrationtypeschema

import (
	"context"
	"embed"
	"encoding/json"
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

//go:embed test-data/*.*
var testData embed.FS

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationTypeSchemaList(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := getTestHelper(t)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "notifications.alerting.grafana.app",
			Version:  "v0alpha1",
			Resource: "integrationtypeschemas",
		},
	})

	t.Run("list should return all integration type schemas with K8s wrapper", func(t *testing.T) {
		listRes, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)

		got, err := json.MarshalIndent(listRes, "", "  ")
		require.NoError(t, err)

		exp, err := testData.ReadFile(path.Join("test-data", "list.json"))
		require.NoError(t, err)

		require.JSONEq(t, string(exp), string(got), "response should match expected snapshot")
	})
}
