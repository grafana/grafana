package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestPerKindSearch_olderBackendOmitsStatusColumns(t *testing.T) {
	fields := []string{fieldTitle, fieldHealth, fieldState, fieldEvaluationDuration}
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
	return NewHandler(client, client), logger, ctx
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
					for key, value := range tc.want {
						want[key] = value
					}
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

func TestPerKindSearch_statusFieldsRejectFilteringAndSorting(t *testing.T) {
	for _, recording := range []bool{false, true} {
		for _, field := range []string{"health", "lastEvaluationTime", "lastError", "evaluationDuration", "state", "stateReason"} {
			for _, operation := range []string{"filter", "sort", "project alert-only recording field"} {
				if operation == "project alert-only recording field" && (!recording || (field != "state" && field != "stateReason")) {
					continue
				}
				t.Run(field+"/"+operation+"/"+map[bool]string{false: "alert", true: "recording"}[recording], func(t *testing.T) {
					index := &fakeIndex{}
					h := NewHandler(index, index)
					route := h.SearchAlertRules
					if recording {
						route = h.SearchRecordingRules
					}
					q := query()
					switch operation {
					case "filter":
						leaf := perKindFilterLeaf(field, perKindFilterOperatorIn, "value")
						q.Where = &leaf
					case "sort":
						q.Sort = []searchv0.SortField{{Field: field}}
					default:
						q.Fields = []string{field}
					}
					body, err := json.Marshal(q)
					require.NoError(t, err)
					rec := httptest.NewRecorder()
					require.NoError(t, WithAPIStatusErrorResponse(route)(context.Background(), rec, &app.CustomRouteRequest{
						ResourceIdentifier: resource.FullIdentifier{Namespace: "default"}, Body: readCloser(string(body)),
					}))
					assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
					assert.Contains(t, rec.Body.String(), field)
					assert.Nil(t, index.got)
				})
			}
		}
	}
}

func TestSearchRules_legacyStatusDoesNotChangeCrossKindResponse(t *testing.T) {
	for _, rule := range []*ngmodels.AlertRule{testAlertRule(), testRecordingRule()} {
		t.Run(ruleType(rule), func(t *testing.T) {
			h, logger, ctx := legacyStatusHandler(t, rule)
			search := func() string {
				rec := httptest.NewRecorder()
				require.NoError(t, h.SearchRules(ctx, rec, &app.CustomRouteRequest{
					ResourceIdentifier: resource.FullIdentifier{Namespace: "default"},
				}))
				require.Equal(t, http.StatusOK, rec.Code)
				return rec.Body.String()
			}
			withoutStatus := search()
			for _, status := range []string{`{"health":"OK","state":"Firing","evaluationDuration":0.125}`, `{"health":`} {
				rule.K8sStatus = []byte(status)
				assert.JSONEq(t, withoutStatus, search())
				assert.Zero(t, logger.WarnLogs.Calls, "cross-kind searches must not decode status")
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
