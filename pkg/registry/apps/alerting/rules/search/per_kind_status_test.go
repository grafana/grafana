package search

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var totalsFields = []string{fieldTotalsHealthy, fieldTotalsFiring, fieldTotalsPending, fieldTotalsRecovering, fieldTotalsNoData, fieldTotalsError}

func TestPerKindSearch_olderBackendOmitsStatusColumns(t *testing.T) {
	fields := append([]string{fieldTitle, fieldHealth, fieldState, fieldEvaluationDuration}, totalsFields...)
	resp := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{searchColumns[fieldTitle]},
			Rows: []*resourcepb.ResourceTableRow{{
				Key:   ruleKey("default", testAlertRule()),
				Cells: [][]byte{[]byte("CPU alert")},
			}},
		},
		TotalHits: 1, TotalHitsExact: true,
	}
	rec, index := callWithBody(t, projection(fields...), resp)
	out := decodeResults(t, rec)
	require.NotNil(t, index.got)
	assert.Equal(t, fields, index.got.Fields)
	require.Len(t, out.Items, 1)
	require.NotNil(t, out.Items[0].Fields)
	assert.Equal(t, map[string]any{fieldTitle: "CPU alert"}, out.Items[0].Fields.Object)
}

func TestPerKindSearch_totalsProjection(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status string
		want   map[string]any
		warn   bool
	}{
		{name: "absent", status: `{}`},
		{name: "null", status: `{"totals":null}`},
		{name: "empty", status: `{"totals":{}}`},
		{name: "null count", status: `{"totals":{"healthy":null}}`},
		{name: "zero", status: `{"totals":{"healthy":0}}`, want: map[string]any{fieldTotalsHealthy: int64(0)}},
		{name: "complete", status: `{"health":"OK","totals":{"healthy":1,"firing":2,"pending":3,"recovering":4,"nodata":5,"error":6,"unknown":7}}`,
			want: map[string]any{fieldHealth: "OK", fieldTotalsHealthy: int64(1), fieldTotalsFiring: int64(2), fieldTotalsPending: int64(3), fieldTotalsRecovering: int64(4), fieldTotalsNoData: int64(5), fieldTotalsError: int64(6)}},
		{name: "wrong shape", status: `{"health":"OK","totals":[]}`, warn: true},
		{name: "wrong count type", status: `{"health":"OK","totals":{"healthy":1,"error":"2"}}`, warn: true},
		{name: "fractional count", status: `{"health":"OK","totals":{"healthy":1,"error":2.5}}`, warn: true},
		{name: "overflow", status: `{"health":"OK","totals":{"healthy":1e20}}`, warn: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rule := testAlertRule()
			rule.K8sStatus = []byte(tc.status)
			h, logger, ctx := legacyStatusHandler(t, rule)
			fields := append([]string{fieldTitle, fieldHealth}, totalsFields...)
			rec := httptest.NewRecorder()
			require.NoError(t, h.SearchAlertRules(ctx, rec, &app.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{Namespace: "default"}, Body: readCloser(projection(fields...)),
			}))
			out := decodeResults(t, rec)
			require.Len(t, out.Items, 1)
			want := map[string]any{fieldTitle: rule.Title}
			maps.Copy(want, tc.want)
			wantJSON, err := json.Marshal(want)
			require.NoError(t, err)
			gotJSON, err := json.Marshal(out.Items[0].Fields.Object)
			require.NoError(t, err)
			assert.JSONEq(t, string(wantJSON), string(gotJSON))
			if tc.warn {
				assert.Equal(t, 1, logger.WarnLogs.Calls)
				assert.Contains(t, logger.WarnLogs.Message, "omitting status")
				return
			}
			assert.Zero(t, logger.WarnLogs.Calls)
			cells, err := ruleCells(want)
			require.NoError(t, err)
			unified, _ := callWithBody(t, projection(fields...), &resourcepb.ResourceSearchResponse{
				Results:   &resourcepb.ResourceTable{Columns: resultColumnDefinitions(), Rows: []*resourcepb.ResourceTableRow{{Key: ruleKey("default", rule), Cells: cells}}},
				TotalHits: 1, TotalHitsExact: true,
			})
			assert.Equal(t, out, decodeResults(t, unified))
			key := ruleKey("default", rule)
			index := realRuleIndex(t, key, fmt.Sprintf(`{
				"apiVersion":"rules.alerting.grafana.app/v0alpha1","kind":"AlertRule",
				"metadata":{"name":%q},"spec":{"title":%q,"expressions":{}},"status":%s
			}`, rule.UID, rule.Title, tc.status), builders.GetAlertRuleSearchBuilder)
			q := &Query{Namespace: "default", Resource: alertrule.ResourceInfo.GroupResource(), Fields: fields, Limit: 10}
			response, err := index.Search(ctx, nil, buildUnifiedRequest(q), nil, nil)
			require.NoError(t, err)
			require.Nil(t, response.Error)
			hits, err := NewUnifiedClient(nil).decodeHits(ctx, q, response)
			require.NoError(t, err)
			require.Len(t, hits, 1)
			assert.Equal(t, want, hits[0].Values)
		})
	}
}

func TestPerKindValidateQuery_totalsAreAlertOnlyAndRetrieveOnly(t *testing.T) {
	for _, name := range totalsFields {
		t.Run(name, func(t *testing.T) {
			q := query()
			q.Fields = []string{name}
			assert.Empty(t, validateFor(t, alertRuleKind(t), q))
			assert.Equal(t, []string{"fields[0]"}, validateFor(t, recordingRuleKind(t), q))
			q.Where = &searchv0.WhereNode{Filter: &searchv0.FilterPredicate{Field: name, Operator: perKindFilterOperatorIn, Values: []string{"1"}}}
			assert.Equal(t, []string{"where.filter.field"}, validateFor(t, alertRuleKind(t), q))
			q.Where = nil
			q.Sort = []searchv0.SortField{{Field: name}}
			assert.Equal(t, []string{"sort[0].field"}, validateFor(t, alertRuleKind(t), q))
		})
	}
}

func TestLegacyStatusValues_totalsPreserveInt64PrecisionAndPresence(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct {
		name   string
		status string
		want   map[string]any
		warn   bool
	}{
		{name: "absent", status: `{"health":"OK"}`, want: map[string]any{fieldHealth: "OK"}},
		{name: "null", status: `{"totals":null}`},
		{name: "empty", status: `{"totals":{}}`},
		{name: "null count", status: `{"totals":{"healthy":null}}`},
		{name: "zero", status: `{"totals":{"healthy":0}}`, want: map[string]any{fieldTotalsHealthy: int64(0)}},
		{name: "above float64 precision", status: `{"totals":{"healthy":9007199254740993}}`, want: map[string]any{fieldTotalsHealthy: int64(9007199254740993)}},
		{name: "max int64", status: `{"totals":{"error":9223372036854775807}}`, want: map[string]any{fieldTotalsError: int64(9223372036854775807)}},
		{name: "overflow omits entire status", status: `{"health":"OK","totals":{"healthy":1,"error":9223372036854775808}}`, warn: true},
		{name: "underflow omits entire status", status: `{"health":"OK","totals":{"healthy":1,"error":-9223372036854775809}}`, warn: true},
		{name: "fraction omits entire status", status: `{"health":"OK","totals":{"healthy":1,"error":2.5}}`, warn: true},
		{name: "fraction near precision boundary", status: `{"health":"OK","totals":{"healthy":9007199254740992.5}}`, warn: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			rule := testAlertRule()
			rule.K8sStatus = []byte(tc.status)
			logger := &logtest.Fake{}
			values := map[string]any{fieldTitle: rule.Title}
			(&legacyClient{logger: logger}).addStatusValues(rule, values)
			want := map[string]any{fieldTitle: rule.Title}
			maps.Copy(want, tc.want)
			assert.Equal(t, want, values)
			if tc.warn {
				assert.Equal(t, 1, logger.WarnLogs.Calls)
				assert.Contains(t, logger.WarnLogs.Message, "omitting status")
			} else {
				assert.Zero(t, logger.WarnLogs.Calls)
			}
		})
	}
}

func TestLegacyStatusValues_recordingRuleIgnoresTotals(t *testing.T) {
	for _, totals := range []string{`{"healthy":1,"error":2}`, `"malformed"`} {
		rule := testRecordingRule()
		rule.K8sStatus = []byte(`{"health":"OK","totals":` + totals + `}`)
		logger := &logtest.Fake{}
		values := map[string]any{}
		(&legacyClient{logger: logger}).addStatusValues(rule, values)
		assert.Equal(t, map[string]any{fieldHealth: "OK"}, values)
		assert.Zero(t, logger.WarnLogs.Calls)
	}
}

type statusSearchAccessControl struct {
	provisioning.RuleAccessControlService
}

type statusSearchStore struct {
	provisioning.RuleStore
	rule *ngmodels.AlertRule
}

func (s statusSearchStore) ListAlertRulesPaginated(context.Context, *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, string, error) {
	return ngmodels.RulesGroup{s.rule}, "", nil
}

func (statusSearchAccessControl) HasAccess(context.Context, identity.Requester, accesscontrol.Evaluator) (bool, error) {
	return true, nil
}

func legacyStatusHandler(t *testing.T, rule *ngmodels.AlertRule) (*Handler, *logtest.Fake, context.Context) {
	t.Helper()
	rule.OrgID = 1
	store := statusSearchStore{rule: rule}
	logger := &logtest.Fake{}
	service := provisioning.NewAlertRuleService(store, fakes.NewFakeProvisioningStore(), nil, nil, nil,
		60, 10, 0, logger, nil, statusSearchAccessControl{}, nil)
	client := NewLegacyClient(*service)
	client.logger = logger
	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1, UserID: 1})
	return NewHandler(selectorForBackend(alertrule.ResourceInfo.GroupResource(), client), selectorForBackend(recordingrule.ResourceInfo.GroupResource(), client)), logger, ctx
}

func TestPerKindSearch_legacyStatusProjection(t *testing.T) {
	for _, recording := range []bool{false, true} {
		kind := "alert"
		if recording {
			kind = "recording"
		}
		t.Run(kind, func(t *testing.T) {
			for _, tc := range []struct {
				name   string
				status string
				want   map[string]any
				warn   bool
			}{
				{name: "absent"},
				{name: "empty object", status: `{}`},
				{name: "null", status: `null`},
				{name: "null fields", status: `{"health":null,"evaluationDuration":null}`},
				{name: "partial", status: `{"health":"Paused"}`, want: map[string]any{"health": "Paused"}},
				{name: "zero duration", status: `{"evaluationDuration":0}`, want: map[string]any{"evaluationDuration": float64(0)}},
				{
					name: "complete with unknown and controller fields",
					status: `{"health":"Error","lastEvaluationTime":"2026-09-17T10:20:30.123Z","lastError":"query failed",` +
						`"evaluationDuration":0.125,"state":"Firing","stateReason":"Evaluated",` +
						`"operatorStates":{"controller":{"state":"failed"}},"additionalFields":{"secret":"hidden"},"unknown":"hidden"}`,
					want: map[string]any{"health": "Error", "lastEvaluationTime": "2026-09-17T10:20:30.123Z", "lastError": "query failed", "evaluationDuration": 0.125},
				},
				{name: "malformed JSON", status: `{"health":"OK",`, warn: true},
				{name: "wrong shape", status: `[]`, warn: true},
				{name: "wrong string type", status: `{"health":42,"evaluationDuration":0.5}`, warn: true},
				{name: "wrong duration type", status: `{"health":"OK","evaluationDuration":"0.125"}`, warn: true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					rule := testAlertRule()
					if recording {
						rule = testRecordingRule()
					}
					rule.K8sStatus = []byte(tc.status)
					h, logger, ctx := legacyStatusHandler(t, rule)
					route := h.SearchAlertRules
					fields := []string{"title", "health", "lastEvaluationTime", "lastError", "evaluationDuration"}
					if recording {
						route = h.SearchRecordingRules
					} else {
						fields = append(fields, "state", "stateReason")
					}
					rec := httptest.NewRecorder()
					require.NoError(t, route(ctx, rec, &app.CustomRouteRequest{
						ResourceIdentifier: resource.FullIdentifier{Namespace: "default"}, Body: readCloser(projection(fields...)),
					}))
					out := decodeResults(t, rec)
					require.Len(t, out.Items, 1)
					require.NotNil(t, out.Items[0].Fields)
					want := map[string]any{"title": rule.Title}
					maps.Copy(want, tc.want)
					if !recording && tc.name == "complete with unknown and controller fields" {
						want["state"], want["stateReason"] = "Firing", "Evaluated"
					}
					assert.Equal(t, want, out.Items[0].Fields.Object)
					if tc.warn {
						require.Equal(t, 1, logger.WarnLogs.Calls)
						assert.Contains(t, logger.WarnLogs.Message, "omitting status")
						assert.Equal(t, []any{"orgID", int64(1), "ruleUID", rule.UID}, logger.WarnLogs.Ctx[:4])
					} else {
						assert.Zero(t, logger.WarnLogs.Calls)
					}
				})
			}
		})
	}
}

func TestLegacyStatusValues_onlyIncludesKindSearchFields(t *testing.T) {
	for _, rule := range []*ngmodels.AlertRule{testAlertRule(), testRecordingRule()} {
		t.Run(ruleType(rule), func(t *testing.T) {
			rule.K8sStatus = []byte(`{"health":"OK","evaluationDuration":0.125,"state":"Firing","stateReason":"Evaluated",` +
				`"operatorStates":{"controller":{"state":"failed"}},"additionalFields":{"health":"Error"},"unknown":"hidden"}`)
			logger := &logtest.Fake{}
			client := &legacyClient{logger: logger}
			values := map[string]any{}
			client.addStatusValues(rule, values)
			want := map[string]any{fieldHealth: "OK", fieldEvaluationDuration: 0.125}
			if rule.Type() != ngmodels.RuleTypeRecording {
				want[fieldState], want[fieldStateReason] = "Firing", "Evaluated"
			}
			assert.Equal(t, want, values)
			assert.Zero(t, logger.WarnLogs.Calls)
		})
	}
}
