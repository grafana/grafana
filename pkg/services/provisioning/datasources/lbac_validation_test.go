package datasources

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
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
)

const provisionedLBACPolicy = `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-Prom-Label-Policy","value":"1:{ customer_secret=\"private\" }"}]}}}`

func TestProvisioningRejectLBACRules(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("enabled-%t", enabled), func(t *testing.T) {
			setProvisioningLBACFlag(t, enabled)
			for _, version := range []int{0, 1} {
				t.Run(fmt.Sprintf("version-%d", version), func(t *testing.T) {
					for _, tc := range []struct {
						name string
						json string
						err  string
					}{
						{"absent", `{"httpMethod":"POST"}`, ""},
						{"null", `{"teamHttpHeaders":null}`, ""},
						{"empty marker", `{"teamHttpHeaders":{}}`, ""},
						{"empty headers", `{"teamHttpHeaders":{"headers":{}}}`, ""},
						{"null headers", `{"teamHttpHeaders":{"headers":null}}`, ""},
						{"empty team rules", `{"teamHttpHeaders":{"headers":{"42":[]}}}`, ""},
						{"custom header", `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-Team-Header","value":"1"}]}}}`, ""},
						{"selector-shaped custom value", `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-Custom-Policy","value":"1:{ customer_secret=\"private\" }"}]}}}`, ""},
						{"LBAC policy", provisionedLBACPolicy, "not supported by file provisioning"},
						{"lowercase header", `{"teamHttpHeaders":{"headers":{"42":[{"header":"x-prom-label-policy","value":"1:{ customer_secret=\"private\" }"}]}}}`, "not supported by file provisioning"},
						{"mixed-case header", `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-pRoM-LaBeL-PoLiCy","value":"1:{ env=\"prod\" }"}]}}}`, "not supported by file provisioning"},
						{"unknown team and invalid selector", `{"teamHttpHeaders":{"headers":{"missing-team":[{"header":"X-Prom-Label-Policy","value":"other-tenant:{ invalid=== }"}]}}}`, "not supported by file provisioning"},
						{"mixed custom and policy", `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-Team-Header","value":"1"},{"header":"X-Prom-Label-Policy","value":"1:{ env=\"prod\" }"}]}}}`, "not supported by file provisioning"},
						{"scalar", `{"teamHttpHeaders":"customer_secret"}`, "invalid structure"},
						{"array", `{"teamHttpHeaders":[]}`, "invalid structure"},
						{"malformed headers", `{"teamHttpHeaders":{"headers":"customer_secret"}}`, "invalid structure"},
						{"malformed rule list", `{"teamHttpHeaders":{"headers":{"42":{}}}}`, "invalid structure"},
						{"missing header name", `{"teamHttpHeaders":{"headers":{"42":[{"value":"customer_secret"}]}}}`, "invalid structure"},
						{"missing header value", `{"teamHttpHeaders":{"headers":{"42":[{"header":"X-Prom-Label-Policy"}]}}}`, "invalid structure"},
					} {
						t.Run(tc.name, func(t *testing.T) {
							dir := t.TempDir()
							writeLBACValidationFile(t, dir, "datasources.yaml", version, tc.json)
							store := &spyStore{}
							correlations := &mockCorrelationsStore{}
							err := Provision(context.Background(), dir, store, correlations, orgtest.NewOrgServiceFake())
							if enabled && tc.err != "" {
								require.ErrorContains(t, err, tc.err)
								require.ErrorContains(t, err, "datasources.yaml")
								require.ErrorContains(t, err, `datasource "metrics"`)
								field := "jsonData.teamHttpHeaders"
								if version == 0 {
									field = "json_data.teamHttpHeaders"
								}
								require.ErrorContains(t, err, field)
								require.NotContains(t, err.Error(), "customer_secret")
								require.Empty(t, store.inserted)
								require.Empty(t, store.updated)
								require.Empty(t, store.deleted)
								require.Empty(t, correlations.deletedBySourceUID)
								return
							}
							require.NoError(t, err)
							require.Len(t, store.inserted, 1)
							got, err := store.inserted[0].JsonData.MarshalJSON()
							require.NoError(t, err)
							require.JSONEq(t, tc.json, string(got))
						})
					}
				})
			}
		})
	}
}

func TestProvisioningRejectLBACBeforeAnyFileWrites(t *testing.T) {
	setProvisioningLBACFlag(t, true)
	dir := t.TempDir()
	valid := `apiVersion: 1
prune: true
deleteDatasources:
  - name: delete-me
datasources:
  - name: existing
    type: prometheus
  - name: new
    type: prometheus
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "00-valid.yaml"), []byte(valid), 0600))
	writeLBACValidationFile(t, dir, "99-lbac.yaml", 1, provisionedLBACPolicy)
	store := &spyStore{items: []*datasources.DataSource{
		{Name: "existing", UID: "existing", OrgID: 1},
		{Name: "delete-me", UID: "delete-me", OrgID: 1},
		{Name: "prune-me", UID: "prune-me", OrgID: 1, IsPrunable: true},
	}}
	correlations := &mockCorrelationsStore{}
	err := Provision(context.Background(), dir, store, correlations, orgtest.NewOrgServiceFake())
	require.ErrorContains(t, err, "99-lbac.yaml")
	require.Empty(t, store.inserted)
	require.Empty(t, store.updated)
	require.Empty(t, store.deleted)
	require.Len(t, store.items, 3)
	require.Empty(t, correlations.created)
	require.Empty(t, correlations.deletedBySourceUID)
}

func TestProvisioningLBACFlagReevaluatedOnReload(t *testing.T) {
	setProvisioningLBACFlag(t, false)
	dir := t.TempDir()
	writeLBACValidationFile(t, dir, "datasources.yaml", 1, provisionedLBACPolicy)
	store := &spyStore{}
	dc := newDatasourceProvisioner(logger, store, &mockCorrelationsStore{}, orgtest.NewOrgServiceFake())
	require.NoError(t, dc.applyChanges(context.Background(), dir))
	require.Len(t, store.inserted, 1)

	setProvisioningLBACFlag(t, true)
	require.ErrorContains(t, dc.applyChanges(context.Background(), dir), "not supported by file provisioning")
	require.Empty(t, store.updated)

	setProvisioningLBACFlag(t, false)
	require.NoError(t, dc.applyChanges(context.Background(), dir))
	require.Len(t, store.updated, 1)
}

func TestProvisioningLBACDefaultRejectsRules(t *testing.T) {
	featuremgmt.WithFlags(t, nil, nil)
	dir := t.TempDir()
	writeLBACValidationFile(t, dir, "datasources.yaml", 1, provisionedLBACPolicy)
	store := &spyStore{}
	require.ErrorContains(t, Provision(context.Background(), dir, store, &mockCorrelationsStore{}, orgtest.NewOrgServiceFake()), "not supported by file provisioning")
	require.Empty(t, store.inserted)
}

func TestProvisioningLBACMissingFlagRejectsRules(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	dir := t.TempDir()
	writeLBACValidationFile(t, dir, "datasources.yaml", 1, provisionedLBACPolicy)
	store := &spyStore{}
	require.ErrorContains(t, Provision(context.Background(), dir, store, &mockCorrelationsStore{}, orgtest.NewOrgServiceFake()), "not supported by file provisioning")
	require.Empty(t, store.inserted)
}

func TestProvisioningLBACGuardAllowsOmissionOnExistingDatasource(t *testing.T) {
	setProvisioningLBACFlag(t, true)
	dir := t.TempDir()
	writeLBACValidationFile(t, dir, "datasources.yaml", 1, `{"httpMethod":"POST"}`)
	stored, err := simplejson.NewJson([]byte(provisionedLBACPolicy))
	require.NoError(t, err)
	store := &spyStore{items: []*datasources.DataSource{{Name: "metrics", UID: "metrics", OrgID: 1, JsonData: stored}}}
	require.NoError(t, Provision(context.Background(), dir, store, &mockCorrelationsStore{}, orgtest.NewOrgServiceFake()))
	require.Empty(t, store.inserted)
	require.Len(t, store.updated, 1)
	_, present := store.items[0].JsonData.CheckGet("teamHttpHeaders")
	require.True(t, present)
}

func writeLBACValidationFile(t *testing.T, dir, name string, version int, jsonData string) {
	t.Helper()
	key := "jsonData"
	if version == 0 {
		key = "json_data"
	}
	config := fmt.Sprintf("apiVersion: %d\ndatasources:\n  - name: metrics\n    type: prometheus\n    %s: %s\n", version, key, jsonData)
	require.NoError(t, os.WriteFile(filepath.Join(dir, name), []byte(config), 0600))
}

func setProvisioningLBACFlag(t *testing.T, enabled bool) {
	t.Helper()
	provider := memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagDatasourcesRejectProvisionedLBACRules: {
			State:          memprovider.Enabled,
			DefaultVariant: "configured",
			Variants:       map[string]any{"configured": enabled},
		},
	})
	require.NoError(t, openfeature.SetProviderAndWait(provider))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}
