package search

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeIndex serves a canned response and records the request it was given, so a
// handler test can assert on both what went down and what came back.
type fakeIndex struct {
	resourcepb.ResourceIndexClient
	resp *resourcepb.ResourceSearchResponse
	err  error
	got  *resourcepb.ResourceSearchRequest
}

func (f *fakeIndex) Search(_ context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	f.got = req
	if f.err != nil {
		return nil, f.err
	}
	return f.resp, nil
}

// legacyRows builds the result table the legacy backend would return for the
// given rules, so a handler test reads real encoded cells rather than a
// hand-built table that could disagree with the encoders.
func legacyRows(t *testing.T, rules ...*ngmodels.AlertRule) *resourcepb.ResourceSearchResponse {
	t.Helper()
	table := &resourcepb.ResourceTable{Columns: resultColumnDefinitions()}
	for _, r := range rules {
		cells, err := ruleCells(r)
		require.NoError(t, err)
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{Key: ruleKey("default", r), Cells: cells})
	}
	return &resourcepb.ResourceSearchResponse{
		Results:        table,
		TotalHits:      int64(len(rules)),
		TotalHitsExact: true,
	}
}

// callWithBody drives one search request end to end and returns the recorder plus
// the index it was served from.
func callWithBody(t *testing.T, body string, resp *resourcepb.ResourceSearchResponse) (*httptest.ResponseRecorder, *fakeIndex) {
	t.Helper()
	return callWith(t, readCloser(body), resp)
}

func callWith(t *testing.T, body io.ReadCloser, resp *resourcepb.ResourceSearchResponse) (*httptest.ResponseRecorder, *fakeIndex) {
	t.Helper()
	index := &fakeIndex{resp: resp}
	h := NewHandler(index, &fakeIndex{})
	rec := httptest.NewRecorder()
	err := WithAPIStatusErrorResponse(h.SearchAlertRules)(context.Background(), rec, &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{Namespace: "default"},
		Body:               body,
	})
	require.NoError(t, err)
	return rec, index
}

func readCloser(s string) *closeTracker {
	return &closeTracker{Reader: strings.NewReader(s)}
}

type closeTracker struct {
	*strings.Reader
	closed bool
}

func (c *closeTracker) Close() error {
	c.closed = true
	return nil
}

// validBody is a minimal well-formed request: the envelope and nothing else.
const validBody = `{"apiVersion":"` + searchv0.APIVERSION + `","kind":"` + searchv0.KindSearchQuery + `"}`

func TestRequestNamespace(t *testing.T) {
	for _, tc := range []struct {
		name      string
		namespace string
		want      string
		wantError string
	}{
		{name: "namespaced request", namespace: "default", want: "default"},
		{name: "missing namespace", wantError: "namespace is required"},
		{name: "all namespaces", namespace: "*", wantError: "searching across namespaces is not supported"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := requestNamespace(&app.CustomRouteRequest{
				ResourceIdentifier: resource.FullIdentifier{Namespace: tc.namespace},
			})
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestMatchSourceDatasourceUIDs_isExact(t *testing.T) {
	rule := &ngmodels.AlertRule{Data: []ngmodels.AlertQuery{
		{DatasourceUID: "source_one"},
		{DatasourceUID: "source-two"},
		{DatasourceUID: expr.DatasourceUID},
	}}

	assert.True(t, matchSourceDatasourceUIDs(rule, nil))
	assert.True(t, matchSourceDatasourceUIDs(rule, []string{"missing", "source_one"}))
	assert.False(t, matchSourceDatasourceUIDs(rule, []string{"sourceXone"}))
	assert.False(t, matchSourceDatasourceUIDs(rule, []string{expr.DatasourceUID}))
}

func TestMatchTitle_treatsSQLWildcardsAsLiterals(t *testing.T) {
	rule := &ngmodels.AlertRule{Title: "CPU_usage at 90%"}
	assert.True(t, matchTitle(rule, "cpu_usage"))
	assert.True(t, matchTitle(rule, "90%"))
	assert.True(t, matchTitle(rule, "%"))
	assert.True(t, matchTitle(rule, "cpu xy"), "short terms are ignored when a searchable term remains")
	assert.False(t, matchTitle(rule, "CPUXusage"))
	assert.False(t, matchTitle(&ngmodels.AlertRule{Title: "CPU usage"}, "%"))
}

func TestTitleSearchTerms_keepsAllShortQueriesMeaningful(t *testing.T) {
	assert.Equal(t, []string{"a", "xy"}, titleSearchTerms("a xy"))
	assert.Equal(t, []string{"cpu"}, titleSearchTerms("cpu xy"))
}

func decodeResults(t *testing.T, rec *httptest.ResponseRecorder) searchv0.SearchResults {
	t.Helper()
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	var out searchv0.SearchResults
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
	return out
}

// TestSearch_requestBody covers decoding. The body is required, because the
// envelope inside it is what identifies the contract being spoken.
func TestSearch_requestBody(t *testing.T) {
	empty := &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}

	t.Run("accepts a well-formed body", func(t *testing.T) {
		rec, _ := callWithBody(t, validBody, empty)
		require.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("rejects an absent body", func(t *testing.T) {
		rec, _ := callWith(t, nil, empty)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects an empty body", func(t *testing.T) {
		rec, _ := callWithBody(t, "", empty)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects unknown fields", func(t *testing.T) {
		rec, _ := callWithBody(t, `{"apiVersion":"`+searchv0.APIVERSION+`","kind":"SearchQuery","bogus":1}`, empty)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects trailing content", func(t *testing.T) {
		rec, _ := callWithBody(t, validBody+validBody, empty)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("rejects malformed JSON", func(t *testing.T) {
		rec, _ := callWithBody(t, `{`, empty)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	// The reader owns the body, so the connection can be released even when the
	// handler stops early.
	t.Run("closes the body", func(t *testing.T) {
		body := readCloser(validBody)
		h := NewHandler(&fakeIndex{resp: empty}, &fakeIndex{})
		require.NoError(t, h.SearchAlertRules(context.Background(), httptest.NewRecorder(), &app.CustomRouteRequest{
			ResourceIdentifier: resource.FullIdentifier{Namespace: "default"},
			Body:               body,
		}))
		assert.True(t, body.closed)
	})
}

// A rejected query is a 422 naming the offending fields, as the generic search
// API reports one, rather than the sdk's blanket 500.
func TestSearch_rejectedQueryIsUnprocessable(t *testing.T) {
	rec, index := callWithBody(t, `{"apiVersion":"`+searchv0.APIVERSION+`","kind":"SearchQuery","limit":-1}`,
		&resourcepb.ResourceSearchResponse{})
	require.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	assert.Nil(t, index.got, "a rejected query must not reach the backend")

	var status map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
	assert.Equal(t, "Failure", status["status"])
	assert.Contains(t, rec.Body.String(), "limit")
}

// The backend reports failures in the payload rather than as a transport error,
// so a payload error has to be turned back into one.
func TestSearch_backendErrorInPayload(t *testing.T) {
	index := &fakeIndex{resp: &resourcepb.ResourceSearchResponse{
		Error: &resourcepb.ErrorResult{Code: http.StatusBadRequest, Message: "bad field"},
	}}
	h := NewHandler(index, &fakeIndex{})
	err := h.SearchAlertRules(context.Background(), httptest.NewRecorder(), &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{Namespace: "default"},
		Body:               readCloser(validBody),
	})
	require.Error(t, err)
	assert.True(t, apierrors.IsBadRequest(err), "got %v", err)
}

// TestSearch_responseEnvelope pins the response envelope. It names the generic
// search group, not the alerting group serving it, so the wire response does not
// change when the generic endpoint takes these routes over.
func TestSearch_responseEnvelope(t *testing.T) {
	rec, _ := callWithBody(t, validBody, legacyRows(t, testAlertRule()))
	out := decodeResults(t, rec)

	assert.Equal(t, searchv0.APIVERSION, out.APIVersion)
	assert.Equal(t, searchv0.KindSearchResults, out.Kind)
	assert.EqualValues(t, 1, out.Metadata.TotalHits)
	assert.Equal(t, searchv0.TotalHitsEqual, out.Metadata.TotalHitsRelation)
	assert.Empty(t, out.Metadata.Continue, "a complete page offers no cursor")

	require.Len(t, out.Items, 1)
	item := out.Items[0]
	assert.Equal(t, "uid1", item.Resource.Name)
	assert.Equal(t, "AlertRule", item.Resource.Kind)
	assert.Equal(t, "alertrules", item.Resource.Resource)
	assert.Equal(t, "rules.alerting.grafana.app", item.Resource.Group)
	// The legacy backend computes no relevance, so no hit claims a score until
	// both backends populate one.
	assert.Nil(t, item.Score)
}

// TestSearch_projection covers what a hit carries. Values are the decoded index
// values, unshaped: that is what the generic endpoint returns for the same
// fields, so re-shaping them here would make the response change at migration.
func TestSearch_projection(t *testing.T) {
	resp := legacyRows(t, testAlertRule())

	t.Run("defaults to title and folder", func(t *testing.T) {
		rec, _ := callWithBody(t, validBody, resp)
		fields := decodeResults(t, rec).Items[0].Fields
		require.NotNil(t, fields)
		assert.Equal(t, map[string]any{"title": "cpu high", "folder": "folder1"}, fields.Object)
	})

	t.Run("returns only the requested fields", func(t *testing.T) {
		rec, _ := callWithBody(t, projection("title", "paused"), resp)
		fields := decodeResults(t, rec).Items[0].Fields
		require.NotNil(t, fields)
		assert.Equal(t, map[string]any{"title": "cpu high", "paused": true}, fields.Object)
	})

	t.Run("keeps each field's own type", func(t *testing.T) {
		rec, _ := callWithBody(t, projection("paused", "panelID", "interval", "for"), resp)
		values := decodeResults(t, rec).Items[0].Fields.Object

		assert.Equal(t, true, values["paused"])
		// Eight digits is exactly the width of the int64 fast path in
		// resourceTableColumn.Decode, so a panel ID written as a decimal string
		// would decode to an unrelated number instead of failing.
		assert.EqualValues(t, 12345678, values["panelID"])
		assert.Equal(t, "1m", values["interval"])
		assert.Equal(t, "5m", values["for"])
	})

	// labels are the flattened terms the index holds and annotations a JSON
	// string, because that is what the generic endpoint returns. A client reading
	// them has to parse them; a client reading them today will not have to change.
	t.Run("returns labels and annotations as indexed", func(t *testing.T) {
		rec, _ := callWithBody(t, projection("labels", "annotations", "datasourceUIDs"), resp)
		values := decodeResults(t, rec).Items[0].Fields.Object

		assert.ElementsMatch(t, []any{"team", "team=a"}, values["labels"])
		assert.JSONEq(t, `{"summary":"cpu is high"}`, values["annotations"].(string))
		// The synthetic expression datasource is not a queried datasource, so it
		// is not indexed as one.
		assert.Equal(t, []any{"ds1"}, values["datasourceUIDs"])
	})

	// A field the rule does not carry is absent rather than present and empty, so
	// a client can tell "unset" from "set to nothing".
	t.Run("omits fields the rule does not carry", func(t *testing.T) {
		rec, _ := callWithBody(t, projection("title", "dashboardUID", "receiver"), legacyRows(t, minimalAlertRule()))
		values := decodeResults(t, rec).Items[0].Fields.Object

		assert.Equal(t, "bare", values["title"])
		assert.NotContains(t, values, "dashboardUID")
		assert.NotContains(t, values, "receiver")
	})

	// The backend is asked for every column whatever the projection, because
	// bleve does not populate them all for a free-text query.
	t.Run("asks the backend for every column", func(t *testing.T) {
		_, index := callWithBody(t, projection("title"), resp)
		require.NotNil(t, index.got)
		assert.ElementsMatch(t, resultColumns, index.got.Fields)
	})
}

// TestSearch_recordingRuleEndpoint asserts the second route reports the recording
// rule identity and reads through the recording rule client, so the two endpoints
// cannot be crossed.
func TestSearch_recordingRuleEndpoint(t *testing.T) {
	alerts, recordings := &fakeIndex{}, &fakeIndex{resp: legacyRows(t, testRecordingRule())}
	h := NewHandler(alerts, recordings)

	rec := httptest.NewRecorder()
	require.NoError(t, h.SearchRecordingRules(context.Background(), rec, &app.CustomRouteRequest{
		ResourceIdentifier: resource.FullIdentifier{Namespace: "default"},
		Body:               readCloser(validBody),
	}))

	out := decodeResults(t, rec)
	require.Len(t, out.Items, 1)
	assert.Equal(t, "RecordingRule", out.Items[0].Resource.Kind)
	assert.Equal(t, "recordingrules", out.Items[0].Resource.Resource)

	require.NotNil(t, recordings.got, "must read through the recording rule client")
	assert.Equal(t, "recordingrules", recordings.got.Options.Key.Resource)
	assert.Nil(t, alerts.got, "must not touch the alert rule client")
}

// A page with more results behind it carries a cursor, and the next request
// resumes from where this one stopped. The token is opaque, so the test reads it
// back through the same encoding rather than asserting on its text.
func TestSearch_continueToken(t *testing.T) {
	resp := legacyRows(t, testAlertRule())
	resp.TotalHits = 5

	rec, _ := callWithBody(t, validBody, resp)
	token := decodeResults(t, rec).Metadata.Continue
	require.NotEmpty(t, token)

	offset, err := decodeCursor(token)
	require.NoError(t, err)
	assert.EqualValues(t, 1, offset, "the next page must resume after the one row returned")

	// Round-tripping the token puts the offset on the next request.
	q := searchv0.SearchQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
		Continue: token,
	}
	body, err := json.Marshal(q)
	require.NoError(t, err)
	_, index := callWithBody(t, string(body), resp)
	require.NotNil(t, index.got)
	assert.EqualValues(t, 1, index.got.Offset)
}

func projection(names ...string) string {
	q := searchv0.SearchQuery{
		TypeMeta: metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: searchv0.KindSearchQuery},
		Fields:   names,
	}
	b, err := json.Marshal(q)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func testAlertRule() *ngmodels.AlertRule {
	dashboardUID := "dash1"
	panelID := int64(12345678)
	return &ngmodels.AlertRule{
		UID:             "uid1",
		Title:           "cpu high",
		NamespaceUID:    "folder1",
		RuleGroup:       "group1",
		IntervalSeconds: 60,
		For:             5 * time.Minute,
		IsPaused:        true,
		Labels:          map[string]string{"team": "a"},
		Annotations:     map[string]string{"summary": "cpu is high"},
		Data:            []ngmodels.AlertQuery{{DatasourceUID: "ds1"}, {DatasourceUID: expr.DatasourceUID}},
		DashboardUID:    &dashboardUID,
		PanelID:         &panelID,
		NotificationSettings: &ngmodels.NotificationSettings{
			ContactPointRouting: &ngmodels.ContactPointRouting{Receiver: "slack"},
		},
	}
}

func minimalAlertRule() *ngmodels.AlertRule {
	return &ngmodels.AlertRule{
		UID:             "uid2",
		Title:           "bare",
		NamespaceUID:    "folder1",
		IntervalSeconds: 60,
	}
}

func testRecordingRule() *ngmodels.AlertRule {
	return &ngmodels.AlertRule{
		UID:             "rec1",
		Title:           "cpu recording",
		NamespaceUID:    "folder1",
		IntervalSeconds: 60,
		Record:          &ngmodels.Record{Metric: "cpu_total", TargetDatasourceUID: "ds-target"},
		Data:            []ngmodels.AlertQuery{{DatasourceUID: "ds1"}},
	}
}
