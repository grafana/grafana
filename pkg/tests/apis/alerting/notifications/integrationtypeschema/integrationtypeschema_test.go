package integrationtypeschema

import (
	"context"
	"embed"
	"encoding/json"
	"path"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

//go:embed test-data/*.*
var testData embed.FS

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationTypeSchema(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	client, err := v0alpha1.NewIntegrationTypeSchemaClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	newIntegrationType := &v0alpha1.IntegrationTypeSchema{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
		},
		Spec: v0alpha1.IntegrationTypeSchemaSpec{
			Name: "Smokesign",
			Type: "smokesign",
		},
	}
	whRaw, err := testData.ReadFile(path.Join("test-data", "webhook.json"))
	require.NoError(t, err)
	var wh v0alpha1.IntegrationTypeSchema
	err = json.Unmarshal(whRaw, &wh)
	require.NoError(t, err)

	t.Run("create should fail", func(t *testing.T) {
		integrationType := newIntegrationType.Copy().(*v0alpha1.IntegrationTypeSchema)
		_, err := client.Create(ctx, integrationType, resource.CreateOptions{})
		require.Truef(t, errors.IsForbidden(err), "Expected Forbidden but got %s", err)
	})

	t.Run("update should fail", func(t *testing.T) {
		integrationType := wh.Copy().(*v0alpha1.IntegrationTypeSchema)
		integrationType.Spec.Type = "mailpidgeon"
		_, err := client.Update(ctx, integrationType, resource.UpdateOptions{})
		require.Truef(t, errors.IsForbidden(err), "Expected Forbidden but got %s", err)
	})

	t.Run("resource should be available by the identifier", func(t *testing.T) {
		integrationType, err := client.Get(ctx, wh.GetStaticMetadata().Identifier())
		require.NoError(t, err)
		require.Equal(t, integrationType.Spec, wh.Spec)
	})

	t.Run("list should return all integration types", func(t *testing.T) {
		listRes, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)

		expRaw, err := testData.ReadFile(path.Join("test-data", "list.json"))
		require.NoError(t, err)

		var exp v0alpha1.IntegrationTypeSchemaList
		require.NoError(t, json.Unmarshal(expRaw, &exp))

		require.Equal(t, exp.Items, listRes.Items)
	})
}
