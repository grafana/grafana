package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	provisioningdatasources "github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationFileLBACGuardPreservesStoredRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagDatasourcesRejectProvisionedLBACRules: {
			State:          memprovider.Enabled,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true},
		},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	ctx := context.Background()
	svc := initDSService(t)
	const policy = `{"headers":{"42":[{"header":"X-Prom-Label-Policy","value":"1:{ env=\"prod\" }"}]}}`
	jsonData, err := simplejson.NewJson([]byte(`{"httpMethod":"GET","teamHttpHeaders":` + policy + `}`))
	require.NoError(t, err)
	// The flag must not guard datasource-service calls made outside file provisioning.
	created, err := svc.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID: 1, Name: "metrics", UID: "metrics", Type: datasources.DS_PROMETHEUS,
		BasicAuth: true, BasicAuthUser: "1", JsonData: jsonData, ReadOnly: true,
	})
	require.NoError(t, err)

	dir := t.TempDir()
	config := `apiVersion: 1
datasources:
  - name: metrics
    type: prometheus
    basicAuth: true
    basicAuthUser: '1'
    jsonData: %s
`
	writeConfig := func(value string) {
		t.Helper()
		require.NoError(t, os.WriteFile(filepath.Join(dir, "datasources.yaml"), []byte(fmt.Sprintf(config, value)), 0600))
	}
	provision := func() error {
		return provisioningdatasources.Provision(ctx, dir, svc, &fileLBACGuardCorrelations{}, orgtest.NewOrgServiceFake())
	}
	writeConfig(`{"httpMethod":"POST"}`)
	require.NoError(t, provision())
	stored, err := svc.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: 1, UID: created.UID})
	require.NoError(t, err)
	got, err := stored.JsonData.Get("teamHttpHeaders").MarshalJSON()
	require.NoError(t, err)
	require.JSONEq(t, policy, string(got))
	require.Equal(t, "POST", stored.JsonData.Get("httpMethod").MustString())
	require.True(t, stored.ReadOnly)

	writeConfig(`{"httpMethod":"GET","teamHttpHeaders":` + policy + `}`)
	require.ErrorContains(t, provision(), "not supported by file provisioning")
	stored, err = svc.GetDataSource(ctx, &datasources.GetDataSourceQuery{OrgID: 1, UID: created.UID})
	require.NoError(t, err)
	got, err = stored.JsonData.Get("teamHttpHeaders").MarshalJSON()
	require.NoError(t, err)
	require.JSONEq(t, policy, string(got))
	require.Equal(t, "POST", stored.JsonData.Get("httpMethod").MustString())
}

type fileLBACGuardCorrelations struct{}

func (*fileLBACGuardCorrelations) DeleteCorrelationsBySourceUID(context.Context, correlations.DeleteCorrelationsBySourceUIDCommand) error {
	return nil
}

func (*fileLBACGuardCorrelations) CreateCorrelation(context.Context, correlations.CreateCorrelationCommand) (correlations.Correlation, error) {
	return correlations.Correlation{}, fmt.Errorf("unexpected correlation creation")
}
