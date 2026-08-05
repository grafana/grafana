package rulesync

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

// These tests exercise the whole sync tick — fetch -> parse -> convert -> apply
// -> prune — with only the datasource HTTP API stubbed (via fakeDatasourceProxy,
// the same seam the real proxy service occupies). The real RulerFetcher and
// prom.ConvertRuleGroup run, so a raw ruler response is turned into stored
// Grafana rule groups the same way as in production, without a database. (The
// database-backed, full-server test lives in pkg/tests/api/alerting.)

// newPipelineSyncer wires a syncer to the real RulerFetcher backed by proxy,
// stubbing only the datasource HTTP API. The rule service and folder store are
// in-memory fakes so assertions can inspect what was applied and pruned.
func newPipelineSyncer(proxy *fakeDatasourceProxy, rs *fakeRuleService, ns fakeNamespaceStore) *ExternalRulerSyncer {
	return &ExternalRulerSyncer{
		settings:          &setting.UnifiedAlertingSettings{DefaultRuleEvaluationInterval: time.Minute, ExternalRulerUID: "ds1"},
		logger:            log.NewNopLogger(),
		metrics:           NewMetrics(nil),
		datasources:       fakeDatasourceGetter{ds: &datasources.DataSource{UID: "ds1", OrgID: 1, Type: datasources.DS_PROMETHEUS, URL: "http://mimir/prometheus"}},
		fetcher:           NewRulerFetcher(proxy, log.NewNopLogger()),
		ruleService:       rs,
		namespaceStore:    ns,
		folderPermissions: &recordingFolderPermissions{},
		lastSyncHash:      make(map[int64]uint64),
	}
}

// rulerAPIResponse serializes cfg the way a Mimir ruler config API would, for
// the stubbed datasource proxy to return.
func rulerAPIResponse(t *testing.T, cfg RulerConfig) []byte {
	t.Helper()
	b, err := yaml.Marshal(cfg)
	require.NoError(t, err)
	return b
}

func TestSyncOrg_FromRulerAPI(t *testing.T) {
	ctx := context.Background()

	t.Run("rules served by the datasource API are fetched, converted and applied", func(t *testing.T) {
		cfg := RulerConfig{
			"cpu": {{
				Name: "cpu-alerts",
				Rules: []apimodels.PrometheusRule{
					{Alert: "HighCPU", Expr: "instance:cpu:ratio > 0.9", Labels: map[string]string{"severity": "warning"}, Annotations: map[string]string{"summary": "CPU high"}},
					{Alert: "HostDown", Expr: "up == 0"},
				},
			}},
			"mem": {{
				Name:  "mem-alerts",
				Rules: []apimodels.PrometheusRule{{Alert: "HighMem", Expr: "instance:mem:ratio > 0.9"}},
			}},
		}
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: rulerAPIResponse(t, cfg)}
		rs := &fakeRuleService{}
		s := newPipelineSyncer(proxy, rs, fakeNamespaceStore{})

		s.SyncOrg(ctx, 1)

		require.Equal(t, 1, proxy.calls, "fetched through the datasource proxy")
		require.Len(t, rs.replaced, 2, "one converted group per namespace")

		rules := map[string]int{}
		folders := map[string]string{}
		for _, g := range rs.replaced {
			rules[g.Title] = len(g.Rules)
			folders[g.Title] = g.FolderUID
		}
		assert.Equal(t, 2, rules["cpu-alerts"])
		assert.Equal(t, 1, rules["mem-alerts"])
		// Each namespace lands in its own subfolder under the sync root.
		assert.Equal(t, "folder-cpu", folders["cpu-alerts"])
		assert.Equal(t, "folder-mem", folders["mem-alerts"])
	})

	t.Run("a group dropped upstream is pruned on the next fetch", func(t *testing.T) {
		// Upstream now serves only cpu-alerts; stale-alerts was synced before but
		// is gone, so it must be pruned while cpu-alerts is kept.
		cfg := RulerConfig{
			"cpu": {{Name: "cpu-alerts", Rules: []apimodels.PrometheusRule{{Alert: "HighCPU", Expr: "up == 0"}}}},
		}
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: rulerAPIResponse(t, cfg)}
		rs := &fakeRuleService{existing: []models.AlertRuleGroupWithFolderFullpath{
			ownedGroup("folder-cpu", "cpu-alerts"),
			ownedGroup("folder-cpu", "stale-alerts"),
		}}
		s := newPipelineSyncer(proxy, rs, fakeNamespaceStore{children: []*folder.FolderReference{{UID: "folder-cpu", Title: "cpu"}}})

		s.SyncOrg(ctx, 1)

		require.Len(t, rs.deleted, 1, "only the dropped group is pruned")
		assert.Equal(t, []string{"folder-cpu"}, rs.deleted[0].NamespaceUIDs)
		assert.Equal(t, []string{"stale-alerts"}, rs.deleted[0].RuleGroups)
	})

	t.Run("an empty ruler prunes everything it previously synced", func(t *testing.T) {
		// Mimir returns 200 {} when it has no rule groups; sync mirrors that by
		// removing the rules it had synced (sync converges to the source).
		proxy := &fakeDatasourceProxy{status: http.StatusOK, body: []byte("{}")}
		rs := &fakeRuleService{existing: []models.AlertRuleGroupWithFolderFullpath{
			ownedGroup("folder-cpu", "cpu-alerts"),
		}}
		s := newPipelineSyncer(proxy, rs, fakeNamespaceStore{children: []*folder.FolderReference{{UID: "folder-cpu", Title: "cpu"}}})

		s.SyncOrg(ctx, 1)

		assert.Empty(t, rs.replaced, "nothing to apply from an empty ruler")
		require.Len(t, rs.deleted, 1, "the previously-synced group is pruned")
		assert.Equal(t, []string{"cpu-alerts"}, rs.deleted[0].RuleGroups)
	})
}
