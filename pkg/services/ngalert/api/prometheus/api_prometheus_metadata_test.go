package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

// fakeRuleGroupReader returns a fixed list of rules for any query.
type fakeRuleGroupReader struct {
	rules ngmodels.RulesGroup
}

func (f *fakeRuleGroupReader) ListAlertRulesByGroup(_ context.Context, _ *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	return f.rules, "", nil
}

var _ rulestore.RuleGroupReader = (*fakeRuleGroupReader)(nil)

// countingMutator tracks how many times it is called.
type countingMutator struct {
	calls int
}

func (m *countingMutator) mutate(_ context.Context, _ *ngmodels.AlertRule, toMutate *apimodels.AlertingRule, _ map[eval.State]struct{}, _ labels.Matchers, _ []ngmodels.LabelOption, _ int64) (map[string]int64, map[string]int64) {
	m.calls++
	toMutate.Health = "ok"
	return map[string]int64{"inactive": 1}, map[string]int64{"inactive": 1}
}

func makeRules(n int) ngmodels.RulesGroup {
	rules := make(ngmodels.RulesGroup, n)
	for i := range rules {
		queryJSON, _ := json.Marshal(map[string]any{
			"datasource":    map[string]any{"type": "prometheus", "uid": "abc123"},
			"expr":          fmt.Sprintf("rate(http_requests_total[5m]) > %d", i),
			"intervalMs":    15000,
			"maxDataPoints": 43200,
		})
		rules[i] = &ngmodels.AlertRule{
			OrgID:        1,
			UID:          fmt.Sprintf("rule-%d", i),
			Title:        fmt.Sprintf("Rule %d", i),
			NamespaceUID: "folder-1",
			RuleGroup:    fmt.Sprintf("group-%d", i/10),
			Labels:       map[string]string{"severity": "critical", "env": "prod"},
			Data: []ngmodels.AlertQuery{
				{
					RefID:         "A",
					DatasourceUID: "prometheus-uid",
					Model:         queryJSON,
				},
			},
		}
	}
	return rules
}

func makeOpts(query url.Values) RuleGroupStatusesOptions {
	return RuleGroupStatusesOptions{
		Ctx:               context.Background(),
		OrgID:             1,
		Query:             query,
		AllowedNamespaces: map[string]string{"folder-1": "Perf Folder"},
	}
}

// TestMetadataOnly_SkipsMutator verifies the mutator is never called when metadata_only=true.
func TestMetadataOnly_SkipsMutator(t *testing.T) {
	store := &fakeRuleGroupReader{rules: makeRules(50)}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("metadata_only", "true")
	q.Set("group_limit", "100")

	PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	assert.Equal(t, 0, m.calls, "mutator should not be called in metadata_only mode")
}

// TestMetadataOnly_MutatorRunsNormally verifies the mutator is called when metadata_only is not set.
func TestMetadataOnly_MutatorRunsNormally(t *testing.T) {
	rules := makeRules(10)
	store := &fakeRuleGroupReader{rules: rules}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("group_limit", "100")

	PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	assert.Equal(t, len(rules), m.calls, "mutator should be called once per rule in normal mode")
}

// TestMetadataOnly_WithStateFilter_Returns400 verifies metadata_only+state filter is rejected.
func TestMetadataOnly_WithStateFilter_Returns400(t *testing.T) {
	store := &fakeRuleGroupReader{rules: makeRules(5)}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("metadata_only", "true")
	q.Set("state", "firing")
	q.Set("group_limit", "100")

	resp := PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	assert.Equal(t, "error", resp.Status)
	assert.Equal(t, 0, m.calls, "mutator should not be called when returning 400")
}

// TestMetadataOnly_WithHealthFilter_Returns400 verifies metadata_only+health filter is rejected.
func TestMetadataOnly_WithHealthFilter_Returns400(t *testing.T) {
	store := &fakeRuleGroupReader{rules: makeRules(5)}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("metadata_only", "true")
	q.Set("health", "error")
	q.Set("group_limit", "100")

	resp := PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	assert.Equal(t, "error", resp.Status)
}

// TestMetadataOnly_ResponseHasNoStateFields verifies state fields are empty in metadata_only responses.
func TestMetadataOnly_ResponseHasNoStateFields(t *testing.T) {
	store := &fakeRuleGroupReader{rules: makeRules(5)}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("metadata_only", "true")
	q.Set("group_limit", "100")

	resp := PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	require.Equal(t, "success", resp.Status)
	for _, group := range resp.Data.RuleGroups {
		for _, rule := range group.Rules {
			assert.Empty(t, rule.Health, "health should be empty in metadata_only response")
			assert.Equal(t, "inactive", rule.State, "state should be default inactive in metadata_only response")
			assert.Empty(t, rule.Query, "query should be empty in metadata_only response")
		}
	}
}

// TestCompact_RunsMutatorAndStripsQuery verifies compact still runs mutator but strips query body.
func TestCompact_RunsMutatorAndStripsQuery(t *testing.T) {
	store := &fakeRuleGroupReader{rules: makeRules(5)}
	m := &countingMutator{}

	q := url.Values{}
	q.Set("compact", "true")
	q.Set("group_limit", "100")

	resp := PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, makeOpts(q), m.mutate, nil)

	require.Equal(t, "success", resp.Status)
	assert.Equal(t, 5, m.calls, "mutator should be called in compact mode")
	for _, group := range resp.Data.RuleGroups {
		for _, rule := range group.Rules {
			assert.Empty(t, rule.Query, "query should be stripped in compact mode")
			assert.NotEmpty(t, rule.Health, "health should be populated in compact mode")
		}
	}
}

// BenchmarkPrepareRuleGroupStatusesV2_Normal is the baseline: full mutator + query serialization.
func BenchmarkPrepareRuleGroupStatusesV2_Normal(b *testing.B) {
	for _, n := range []int{100, 500, 1000} {
		store := &fakeRuleGroupReader{rules: makeRules(n)}
		m := &countingMutator{}
		q := url.Values{}
		q.Set("group_limit", fmt.Sprintf("%d", n+1))
		opts := makeOpts(q)

		b.Run(fmt.Sprintf("rules=%d", n), func(b *testing.B) {
			for b.Loop() {
				m.calls = 0
				PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, opts, m.mutate, nil)
			}
		})
	}
}

// BenchmarkPrepareRuleGroupStatusesV2_MetadataOnly shows the improvement from skipping mutator+query.
func BenchmarkPrepareRuleGroupStatusesV2_MetadataOnly(b *testing.B) {
	for _, n := range []int{100, 500, 1000} {
		store := &fakeRuleGroupReader{rules: makeRules(n)}
		m := &countingMutator{}
		q := url.Values{}
		q.Set("metadata_only", "true")
		q.Set("group_limit", fmt.Sprintf("%d", n+1))
		opts := makeOpts(q)

		b.Run(fmt.Sprintf("rules=%d", n), func(b *testing.B) {
			for b.Loop() {
				m.calls = 0
				PrepareRuleGroupStatusesV2(log.NewNopLogger(), store, opts, m.mutate, nil)
			}
		})
	}
}
