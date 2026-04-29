package integrationtypeschema

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
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

		if !assert.JSONEq(t, string(exp), string(got), "response should match expected snapshot") {
			var prettyJSON bytes.Buffer
			err = json.Indent(&prettyJSON, got, "", "  ")
			require.NoError(t, err, "failed to indent snapshot")
			err = os.WriteFile(path.Join("test-data", "list.json"), prettyJSON.Bytes(), 0o644)
			require.NoError(t, err, "failed to update snapshot")
		}
	})
}

func TestIntegrationTypeSchemaList_AllowedIntegrationsFlipsCanCreate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		UnifiedAlertingAllowedIntegrations: []string{"slack"},
	})
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR: schema.GroupVersionResource{
			Group:    "notifications.alerting.grafana.app",
			Version:  "v0alpha1",
			Resource: "integrationtypeschemas",
		},
	})

	listRes, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)

	got, err := json.Marshal(listRes)
	require.NoError(t, err)

	var parsed struct {
		Items []struct {
			Spec struct {
				Type     string `json:"type"`
				Versions []struct {
					CanCreate *bool `json:"canCreate"`
				} `json:"versions"`
			} `json:"spec"`
		} `json:"items"`
	}
	require.NoError(t, json.Unmarshal(got, &parsed))

	byType := make(map[string][]bool)
	for _, item := range parsed.Items {
		for _, v := range item.Spec.Versions {
			canCreate := v.CanCreate != nil && *v.CanCreate
			byType[item.Spec.Type] = append(byType[item.Spec.Type], canCreate)
		}
	}

	require.Contains(t, byType, "slack", "slack should be in the response")
	slackHasCreatable := false
	for _, c := range byType["slack"] {
		if c {
			slackHasCreatable = true
			break
		}
	}
	require.True(t, slackHasCreatable, "slack must have at least one creatable version when in allowlist")

	require.Contains(t, byType, "email", "email should still be listed (not removed, just disabled)")
	for _, c := range byType["email"] {
		require.False(t, c, "every email version must have canCreate=false when not in allowlist")
	}
}
