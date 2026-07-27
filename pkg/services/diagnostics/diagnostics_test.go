package diagnostics

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

func TestBundler_Build(t *testing.T) {
	// No HAR captured (empty buffer, nil response) -> traffic.har omitted; only panel.json present.
	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, json.RawMessage(`{"id":1}`), nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panel.json")
	require.NotContains(t, files, "traffic.har", "no HAR was captured")
	require.NotContains(t, files, "dashboard.json", "no dashboard JSON supplied")
	require.NotContains(t, files, "server.log", "server log is intentionally omitted until it can be request-scoped")
	require.NotContains(t, files, "query-error.txt", "no query error")
	require.JSONEq(t, `{"id":1}`, string(files["panel.json"]))
}

func TestBundler_Build_recordsQueryError(t *testing.T) {
	// A failed query must still produce a bundle, with the error recorded (capture is not discarded).
	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, nil, nil, errors.New("datasource timeout"))
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "query-error.txt")
	require.Contains(t, string(files["query-error.txt"]), "datasource timeout")
}

func TestBundler_Build_recordsQueryDataMarshalError(t *testing.T) {
	// A query-data artifact that cannot be JSON-encoded (here forced with an invalid request payload,
	// the same failure mode as a non-finite float in a response) must not sink the whole bundle: the
	// error is recorded and the other artifacts still ship, mirroring the per-panel dashboard path.
	buf := bufferWithEntry(t, "http://ds/1")

	blob, err := NewBundler().Build(nil, buf, nil, nil, json.RawMessage(`{invalid`), nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "querydata.json", "unserializable query data is omitted")
	require.Contains(t, files, "querydata-error.txt")
	require.Contains(t, string(files["querydata-error.txt"]), "invalid character")
	require.Contains(t, files, "traffic.har", "other artifacts still ship")
}

func TestBundler_Build_recordsQueryRequestSerializeError(t *testing.T) {
	// The caller failing to serialize the request (queryRequestErr) must not silently omit the request:
	// the failure is recorded in querydata-error.txt and the other captured artifacts still ship,
	// mirroring how the per-panel dashboard path surfaces the same failure via manifest.queryDataError.
	buf := bufferWithEntry(t, "http://ds/1")

	blob, err := NewBundler().Build(nil, buf, nil, nil, nil, errors.New("unsupported value: +Inf"), nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "querydata.json", "request could not be serialized")
	require.Contains(t, files, "querydata-error.txt")
	require.Contains(t, string(files["querydata-error.txt"]), "serialize query request")
	require.Contains(t, string(files["querydata-error.txt"]), "unsupported value: +Inf")
	require.Contains(t, files, "traffic.har", "other artifacts still ship")
}

func TestBundler_Build_recordsQueryDataResponse(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frame}},
	}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")
	require.Contains(t, string(files["querydata.json"]), `"A"`)
	require.Contains(t, string(files["querydata.json"]), `42`)
}

func TestBundler_Build_writesSnapshotBackend(t *testing.T) {
	// The snapshot must render the returned frames OFFLINE: a Grafana-datasource snapshot query
	// carrying the frame, with no reference to the original datasource.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frame}},
	}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "snapshot-backend.json")

	var dash struct {
		Panels []struct {
			Datasource struct {
				UID string `json:"uid"`
			} `json:"datasource"`
			Targets []struct {
				QueryType  string `json:"queryType"`
				Datasource struct {
					UID string `json:"uid"`
				} `json:"datasource"`
				Snapshot []json.RawMessage `json:"snapshot"`
			} `json:"targets"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["snapshot-backend.json"], &dash))
	require.Len(t, dash.Panels, 1)
	require.Equal(t, "grafana", dash.Panels[0].Datasource.UID, "panel points at the Grafana snapshot datasource")
	require.Len(t, dash.Panels[0].Targets, 1)
	require.Equal(t, "snapshot", dash.Panels[0].Targets[0].QueryType)
	require.Equal(t, "grafana", dash.Panels[0].Targets[0].Datasource.UID)
	require.NotEmpty(t, dash.Panels[0].Targets[0].Snapshot, "baked frames are present")
	require.Contains(t, string(files["snapshot-backend.json"]), "42", "the baked value is carried")
}

// The dashboard scaffold around the panel, which nothing else asserts. schemaVersion is the load-bearing
// one: it decides whether an import runs migrations over the panel model. The client sends a save model
// already migrated to the frontend's current version, so the artifact must claim the same version --
// understating it re-runs migrations over an already-migrated panel, and there is no cheap way to notice
// either mistake from the rendered result.
func TestBundler_Build_snapshotDashboardScaffold(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	var dash struct {
		SchemaVersion int    `json:"schemaVersion"`
		Title         string `json:"title"`
		Editable      bool   `json:"editable"`
	}
	require.NoError(t, json.Unmarshal(readTarGz(t, blob)["snapshot-backend.json"], &dash))
	require.Equal(t, schemaversion.LATEST_VERSION, dash.SchemaVersion,
		"the baked dashboard claims the schema version the client's save model is already at")
	require.Equal(t, snapshotArtifactTitle, dash.Title)
	require.True(t, dash.Editable, "a support engineer has to be able to poke at the imported panel")
}

func TestBundler_Build_snapshotKeepsPanelVizButOverridesDatasource(t *testing.T) {
	// A supplied panel model contributes its viz/config, but its live datasource + targets are
	// replaced so the imported snapshot can never re-query.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{7}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"type":"stat","title":"CPU","datasource":{"type":"prometheus","uid":"prom-x"},"targets":[{"refId":"A","expr":"up"}]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	snap := string(files["snapshot-backend.json"])
	require.Contains(t, snap, `"stat"`, "keeps the panel viz type")
	require.NotContains(t, snap, "prom-x", "the original datasource is replaced")
	require.NotContains(t, snap, `"expr"`, "the live query is replaced by the snapshot query")
}

func TestBundler_Build_noSnapshotWithoutResponse(t *testing.T) {
	// A request-only bundle (no response) has no frames to bake, so no snapshot is written.
	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, json.RawMessage(`{"queries":[]}`), nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "snapshot-backend.json")
	require.NotContains(t, files, "snapshot-backend-error.txt", "nothing to bake is not a failure")
}

// Every refID's frames go into ONE snapshot target: the Grafana datasource emits each snapshot target
// as a keyless response packet, so sibling targets collapse onto the same key in the query runner and
// all but one would be dropped. The merge loses the response map's per-refID grouping, so each frame
// carries the refId it came from.
func TestBundler_Build_snapshotMergesRefIDsIntoOneTarget(t *testing.T) {
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"B": {Frames: data.Frames{data.NewFrame("mem", data.NewField("value", nil, []float64{2}))}},
		"A": {Frames: data.Frames{data.NewFrame("cpu", data.NewField("value", nil, []float64{1}))}},
	}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	var dash struct {
		Panels []struct {
			Targets []struct {
				RefID    string `json:"refId"`
				Snapshot []struct {
					Schema struct {
						Name  string `json:"name"`
						RefID string `json:"refId"`
					} `json:"schema"`
				} `json:"snapshot"`
			} `json:"targets"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["snapshot-backend.json"], &dash))
	require.Len(t, dash.Panels[0].Targets, 1, "one target, not one per refID")
	require.Equal(t, "A", dash.Panels[0].Targets[0].RefID)

	frames := dash.Panels[0].Targets[0].Snapshot
	require.Len(t, frames, 2, "both refIDs' frames are baked")
	// Sorted by refID, so A's frame comes first regardless of response map iteration order.
	require.Equal(t, "cpu", frames[0].Schema.Name)
	require.Equal(t, "A", frames[0].Schema.RefID, "the frame carries the refId it came from")
	require.Equal(t, "mem", frames[1].Schema.Name)
	require.Equal(t, "B", frames[1].Schema.RefID)
}

// A frame that already names its refId keeps it, and the caller's response is left untouched (Build
// also serializes it for querydata.json).
func TestBundler_Build_snapshotDoesNotMutateResponseFrames(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.RefID = "Q1"
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	require.Equal(t, "Q1", frame.RefID, "the response frame is not stamped in place")
	require.Contains(t, string(readTarGz(t, blob)["snapshot-backend.json"]), `"refId": "Q1"`)
}

// Without a baked time range an import defaults to now-6h and the frames sit outside the window, so
// the panel renders empty. The client submits epoch milliseconds; a dashboard parses time.from/to as
// a date expression, so they have to be absolute timestamps.
func TestBundler_Build_snapshotBakesRequestTimeRange(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	request := json.RawMessage(`{"from":"1690000000000","to":"1690003600000","queries":[{"refId":"A"}]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	var dash struct {
		Time struct {
			From string `json:"from"`
			To   string `json:"to"`
		} `json:"time"`
	}
	require.NoError(t, json.Unmarshal(readTarGz(t, blob)["snapshot-backend.json"], &dash))
	require.Equal(t, time.UnixMilli(1690000000000).UTC().Format(time.RFC3339Nano), dash.Time.From)
	require.Equal(t, time.UnixMilli(1690003600000).UTC().Format(time.RFC3339Nano), dash.Time.To)
}

// A non-browser caller can submit a relative range; it is passed through rather than mangled.
func TestBundler_Build_snapshotKeepsRelativeTimeRange(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	request := json.RawMessage(`{"from":"now-1h","to":"now","queries":[{"refId":"A"}]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	require.Contains(t, string(readTarGz(t, blob)["snapshot-backend.json"]), `"from": "now-1h"`)
}

// v2 dashboards store panels as {kind, spec}. The translatable viz config is lifted into the v1
// snapshot panel; the query definitions (and the datasource they name) are not carried over.
func TestBundler_Build_snapshotFlattensV2PanelElement(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{
		"kind": "Panel",
		"spec": {
			"id": 3,
			"title": "CPU",
			"description": "how busy",
			"data": {"kind": "QueryGroup", "spec": {
				"queries": [{"kind": "PanelQuery", "spec": {"refId": "A", "query": {"kind": "prometheus", "group": "prometheus", "datasource": {"name": "prom-x"}, "spec": {"expr": "up"}}}}],
				"transformations": [{"kind": "reduce", "group": "reduce", "spec": {"options": {}}}],
				"queryOptions": {}
			}},
			"vizConfig": {"kind": "VizConfig", "group": "stat", "version": "11.0.0", "spec": {
				"options": {"colorMode": "value"},
				"fieldConfig": {"defaults": {"unit": "percent"}, "overrides": []}
			}}
		}
	}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	snap := string(files["snapshot-backend.json"])
	var dash struct {
		Panels []struct {
			Type          string `json:"type"`
			Title         string `json:"title"`
			Description   string `json:"description"`
			PluginVersion string `json:"pluginVersion"`
			Options       struct {
				ColorMode string `json:"colorMode"`
			} `json:"options"`
			FieldConfig struct {
				Defaults struct {
					Unit string `json:"unit"`
				} `json:"defaults"`
			} `json:"fieldConfig"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["snapshot-backend.json"], &dash))
	require.Equal(t, "stat", dash.Panels[0].Type, "the plugin id comes from vizConfig.group")
	require.Equal(t, "CPU", dash.Panels[0].Title)
	require.Equal(t, "how busy", dash.Panels[0].Description)
	require.Equal(t, "11.0.0", dash.Panels[0].PluginVersion)
	require.Equal(t, "value", dash.Panels[0].Options.ColorMode)
	require.Equal(t, "percent", dash.Panels[0].FieldConfig.Defaults.Unit)
	require.NotContains(t, snap, "prom-x", "the v2 query's datasource is not carried into the artifact")
	require.NotContains(t, snap, "vizConfig", "the v2 wrapper is translated, not copied")
	require.NotContains(t, snap, `"spec"`)
}

// v2alpha1 named the plugin in vizConfig.kind before it moved to vizConfig.group.
func TestBundler_Build_snapshotFlattensV2AlphaPanelElement(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"kind":"Panel","spec":{"id":3,"title":"CPU","vizConfig":{"kind":"gauge","spec":{"options":{},"fieldConfig":{}}}}}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	var dash struct {
		Panels []struct {
			Type string `json:"type"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(readTarGz(t, blob)["snapshot-backend.json"], &dash))
	require.Equal(t, "gauge", dash.Panels[0].Type)
}

// A library-panel ref would make the import resolve the panel from a uid the reader's Grafana doesn't
// have, discarding the baked targets. Transformations are dropped too: the baked frames are the
// plugin's output before frontend processing.
func TestBundler_Build_snapshotDropsLibraryPanelAndTransformations(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"type":"stat","title":"CPU","libraryPanel":{"uid":"lib-1","name":"Shared CPU"},"transformations":[{"id":"reduce","options":{}}],"snapshotData":[]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	snap := string(readTarGz(t, blob)["snapshot-backend.json"])
	require.NotContains(t, snap, "libraryPanel")
	require.NotContains(t, snap, "lib-1")
	require.NotContains(t, snap, "transformations")
	require.NotContains(t, snap, "snapshotData")
	require.Contains(t, snap, `"stat"`, "the rest of the panel model still contributes")
}

// A frame the SDK cannot encode costs only the snapshot: querydata.json still ships (degraded), and
// the reason the snapshot is missing is recorded rather than swallowed.
func TestBundler_Build_recordsSnapshotEncodeFailure(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "snapshot-backend.json")
	require.Contains(t, string(files["snapshot-backend-error.txt"]), "encode frame for refId A")
	require.Contains(t, files, "querydata.json", "the authoritative record still ships")
}

// The snapshot is a convenience artifact, but a reader must be able to tell "no frames to bake" from
// "the snapshot didn't fit" -- the single-panel bundle has no manifest to record it in.
func TestBundler_Build_recordsOversizedSnapshot(t *testing.T) {
	frame := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", maxQueryDataArtifactBytes)}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "snapshot-backend.json")
	require.Contains(t, files, "snapshot-backend-error.txt")
	require.Contains(t, string(files["snapshot-backend-error.txt"]), "exceeded")
}

// A panel-level time override must not survive into the snapshot: the client reads the submitted range
// from the panel's EFFECTIVE range, so the override is already resolved into the absolute timestamps
// baked into the dashboard. Keeping it applies the override twice -- a timeShift moves the panel's
// window off the frames entirely and it renders empty.
func TestBundler_Build_snapshotDropsPanelTimeOverride(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"type":"timeseries","title":"CPU","timeFrom":"5m","timeShift":"1d","timeCompare":"1h","hideTimeOverride":true}`)
	// The submitted range is the shifted one the panel actually queried.
	request := json.RawMessage(`{"from":"1690000000000","to":"1690003600000","queries":[{"refId":"A"}]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, request, nil, nil)
	require.NoError(t, err)

	snap := string(readTarGz(t, blob)["snapshot-backend.json"])
	require.NotContains(t, snap, "timeFrom")
	require.NotContains(t, snap, "timeShift")
	require.NotContains(t, snap, "timeCompare")
	require.NotContains(t, snap, "hideTimeOverride")
	// The baked range still stands on its own, and the rest of the panel model survives.
	require.Contains(t, snap, `"from": "`+time.UnixMilli(1690000000000).UTC().Format(time.RFC3339Nano)+`"`)
	require.Contains(t, snap, `"CPU"`)
}

// Repeat must not survive either, and for a reason a no-op check wouldn't catch: the snapshot dashboard
// has no templating, so the repeat processor binds the panel to an EMPTY value for the missing variable
// and "$host" in the title renders blank instead of naming the captured series. A repeated panel is the
// common case -- the client resolves a clone's save model back to the source panel that carries these.
func TestBundler_Build_snapshotDropsPanelRepeat(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"type":"timeseries","title":"CPU $host","repeat":"host","repeatDirection":"h","maxPerRow":2}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	snap := string(readTarGz(t, blob)["snapshot-backend.json"])
	require.NotContains(t, snap, "repeat")
	require.NotContains(t, snap, "repeatDirection")
	require.NotContains(t, snap, "maxPerRow")
	// The title is kept verbatim, unresolved variable and all: it says more about what was captured
	// than the blank the repeat processor would have substituted.
	require.Contains(t, snap, `"CPU $host"`)
}

// A panel model that isn't a JSON object at all must cost only the panel's viz, never the snapshot:
// the frames are the point of the artifact.
func TestBundler_Build_snapshotFallsBackOnMalformedPanelJSON(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	for name, panelJSON := range map[string]json.RawMessage{
		"not json":           json.RawMessage(`{"type":`),
		"array":              json.RawMessage(`[{"type":"stat"}]`),
		"v2 spec not object": json.RawMessage(`{"kind":"Panel","spec":"nonsense"}`),
	} {
		t.Run(name, func(t *testing.T) {
			blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
			require.NoError(t, err)

			files := readTarGz(t, blob)
			require.Contains(t, files, "snapshot-backend.json", "a bad panel model must not lose the snapshot")
			require.NotContains(t, files, "snapshot-backend-error.txt")

			var dash struct {
				Panels []struct {
					Type    string `json:"type"`
					Targets []struct {
						QueryType string            `json:"queryType"`
						Snapshot  []json.RawMessage `json:"snapshot"`
					} `json:"targets"`
				} `json:"panels"`
			}
			require.NoError(t, json.Unmarshal(files["snapshot-backend.json"], &dash))
			require.Len(t, dash.Panels, 1)
			require.Equal(t, "timeseries", dash.Panels[0].Type, "falls back to a minimal panel")
			require.Len(t, dash.Panels[0].Targets, 1)
			require.Equal(t, "snapshot", dash.Panels[0].Targets[0].QueryType)
			require.NotEmpty(t, dash.Panels[0].Targets[0].Snapshot, "the frames still make it in")
		})
	}
}

// A v2 LibraryPanel element's spec is only {id, title, libraryPanel} -- the viz lives in the library.
// The library REF must stay out of the artifact (an import would otherwise resolve the panel from a uid
// the reader's Grafana doesn't have, discarding the baked frames); the viz type is unavoidably lost, so
// the frames render with the fallback.
func TestBundler_Build_snapshotDropsV2LibraryPanelRef(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	panelJSON := json.RawMessage(`{"kind":"LibraryPanel","spec":{"id":4,"title":"Shared CPU","libraryPanel":{"uid":"lib-1","name":"Shared CPU"}}}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, panelJSON, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	snap := string(files["snapshot-backend.json"])
	require.NotContains(t, snap, "libraryPanel")
	require.NotContains(t, snap, "lib-1")

	var dash struct {
		Panels []struct {
			Type  string `json:"type"`
			Title string `json:"title"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["snapshot-backend.json"], &dash))
	require.Equal(t, "Shared CPU", dash.Panels[0].Title, "identity survives")
	require.Equal(t, "timeseries", dash.Panels[0].Type, "the viz is not in the dashboard model to recover")
	require.Contains(t, snap, "42", "the frames are what the artifact is for")
}

func TestBundler_Build_recordsQueryDataRequest(t *testing.T) {
	request := json.RawMessage(`{"from":"now-1h","to":"now","queries":[{"refId":"A","expr":"up"}]}`)

	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "querydata.json")
	require.Contains(t, string(files["querydata.json"]), `"request"`)
	require.Contains(t, string(files["querydata.json"]), `"expr": "up"`)
}

func TestBundler_Build_excludesCaptureFramesFromQueryData(t *testing.T) {
	result := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	capture := data.NewFrame("")
	capture.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A":         {Frames: data.Frames{result}},
		"__har__ds": {Frames: data.Frames{capture}},
	}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, string(files["querydata.json"]), "__har__")
	require.Contains(t, string(files["querydata.json"]), `"A"`)
}

func TestBundler_Build_boundsOversizedQueryData(t *testing.T) {
	frame := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", maxQueryDataArtifactBytes)}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frame}},
	}}

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := files["querydata.json"]
	require.LessOrEqual(t, len(queryData), maxQueryDataArtifactBytes)
	require.Contains(t, string(queryData), `"truncated": true`)
	require.Contains(t, string(queryData), `"rows": 1`)
	require.Contains(t, string(queryData), `"refId": "A"`)
}

func TestBundler_Build_boundsOversizedRequestWithoutResponse(t *testing.T) {
	// An oversized request with no response must truncate without claiming a response was omitted.
	request := json.RawMessage(`{"expr":"` + strings.Repeat("x", maxQueryDataArtifactBytes) + `"}`)

	blob, err := NewBundler().Build(nil, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := files["querydata.json"]
	require.LessOrEqual(t, len(queryData), maxQueryDataArtifactBytes)
	require.Contains(t, string(queryData), `"truncated": true`)
	require.Contains(t, string(queryData), `"requestOmitted": true`)
	require.NotContains(t, string(queryData), `"responseOmitted"`)
}

func TestBundler_Build_preservesUpstreamAndPluginResultsForComparison(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "http://prometheus/api/v1/query", nil)
	require.NoError(t, err)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Status:     "200 OK",
		Proto:      "HTTP/1.1",
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"series":["host-a","host-b"]}`)),
	}
	buf := &harcapture.Buffer{}
	buf.AddEntry(req, resp, nil, time.Now(), time.Millisecond)

	pluginFrame := data.NewFrame("cpu", data.NewField("host", nil, []string{"host-a"}))
	queryResp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{pluginFrame}},
	}}
	blob, err := NewBundler().Build(queryResp, buf, nil, nil, nil, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, string(files["traffic.har"]), "host-b", "upstream returned host-b")
	require.NotContains(t, string(files["querydata.json"]), "host-b", "plugin dropped host-b")
	require.Contains(t, string(files["querydata.json"]), "host-a")
}

func TestMergeHAR(t *testing.T) {
	d1 := []byte(`{"log":{"creator":{"name":"A","version":"1"},"entries":[{"n":1}]}}`)
	d2 := []byte(`{"log":{"entries":[{"n":2},{"n":3}]}}`)
	malformed := []byte(`not json`)

	out, err := mergeHAR([][]byte{d1, malformed, d2})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Version string            `json:"version"`
			Creator json.RawMessage   `json:"creator"`
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Equal(t, "1.2", env.Log.Version)
	require.Len(t, env.Log.Entries, 3, "entries from all valid docs are concatenated; malformed skipped")
	require.JSONEq(t, `{"name":"A","version":"1"}`, string(env.Log.Creator), "first creator is kept")

	// No parseable entries -> (nil, nil): benign "nothing captured", not an error.
	out, err = mergeHAR([][]byte{malformed})
	require.NoError(t, err)
	require.Nil(t, out)
	out, err = mergeHAR(nil)
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_emptyExternalFrame_benign(t *testing.T) {
	// A valid-but-empty external frame ({"log":{"entries":[]}}) is "no traffic", not a failure:
	// collectHAR must return (nil, nil) so the handler produces a 200 bundle without traffic.har,
	// not a 500. (Regression guard: an untrusted plugin's empty capture must not fail the run.)
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestHasCapturedHAR(t *testing.T) {
	require.False(t, HasCapturedHAR(nil, &harcapture.Buffer{}), "no buffer entries, no response")
	require.False(t, HasCapturedHAR(&backend.QueryDataResponse{Responses: backend.Responses{}}, &harcapture.Buffer{}))

	// In-process buffer with entries counts as captured.
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)
	require.True(t, HasCapturedHAR(nil, buf), "buffer with entries -> captured")

	// An external __har__ frame counts as captured even when the in-process buffer is empty — the
	// handler must not short-circuit a failed query away in that case.
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}
	require.True(t, HasCapturedHAR(resp, &harcapture.Buffer{}))

	// A __har__ frame WITHOUT a har payload must NOT count as captured (else the no-capture error
	// path is wrongly suppressed and the bundle is empty).
	empty := data.NewFrame("")
	empty.Meta = &data.FrameMeta{Custom: map[string]interface{}{"other": "x"}}
	noPayload := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{empty}}}}
	require.False(t, HasCapturedHAR(noPayload, &harcapture.Buffer{}), "frame without a har payload is not captured traffic")

	// A __har__ frame with a non-empty but unparseable har payload must NOT count as captured
	// either: collectHAR/mergeHAR would skip it and contribute nothing, so counting it here would
	// let a failed query fall through to a 200 bundle with no traffic.har -- the exact outcome the
	// no-capture error path exists to prevent.
	malformed := data.NewFrame("")
	malformed.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "not valid har"}}
	malformedResp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{malformed}}}}
	require.False(t, HasCapturedHAR(malformedResp, &harcapture.Buffer{}), "a malformed har payload is not captured traffic")
}

func TestCollectHAR_malformedExternalFrame_benign(t *testing.T) {
	// A frame carries a non-empty but unparseable "har" payload and there's no in-process buffer.
	// Redaction is deferred, so the frame is merged verbatim: mergeHAR skips the unparseable document
	// and, with no other entries, returns (nil, nil) — a benign empty bundle, not an error.
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "not valid har"}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_ExternalFramesVerbatim_andNilFrame(t *testing.T) {
	// A frame with a secret in a request header. Redaction is intentionally deferred, so it must be
	// merged VERBATIM (the secret is preserved, not stripped) — same policy as in-process capture.
	frameHAR := `{"log":{"entries":[{"request":{"headers":[{"name":"Authorization","value":"Bearer FRAMESECRET"}],"queryString":[],"cookies":[],"url":"http://x/y"},"response":{"headers":[],"cookies":[]}}]}}`
	withHAR := data.NewFrame("")
	withHAR.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": frameHAR}}

	resp := &backend.QueryDataResponse{
		Responses: backend.Responses{
			// A nil frame must not panic (regression guard), and the HAR frame must be collected.
			"__har__": backend.DataResponse{Frames: data.Frames{nil, withHAR}},
		},
	}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 1)
	require.Contains(t, string(out), "FRAMESECRET", "external-plugin frame is merged verbatim (redaction deferred)")

	_, ok := resp.Responses["__har__"]
	require.False(t, ok, "__har__ synthetic response is consumed, not returned to the client")
}

func TestCollectHAR_nilBuffer_noPanic(t *testing.T) {
	out, err := collectHAR(nil, nil)
	require.NoError(t, err)
	require.Nil(t, out)

	// A nil buffer must also flow through Build without panicking.
	bundle, err := NewBundler().Build(nil, nil, nil, nil, nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, bundle)
}

func TestCollectHAR_Empty(t *testing.T) {
	out, err := collectHAR(nil, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)

	out, err = collectHAR(&backend.QueryDataResponse{Responses: backend.Responses{}}, &harcapture.Buffer{})
	require.NoError(t, err)
	require.Nil(t, out)
}

func TestCollectHAR_BufferOnly_returnedVerbatim(t *testing.T) {
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)

	out, err := collectHAR(nil, buf)
	require.NoError(t, err)
	require.NotNil(t, out)

	// With no external frames, the buffer's own HAR document is returned as-is (no mergeHAR
	// re-marshal round-trip), so it must be byte-identical to Buffer.ToHAR().
	want, err := buf.ToHAR()
	require.NoError(t, err)
	require.Equal(t, want, out)

	var doc struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &doc))
	require.Len(t, doc.Log.Entries, 1)
}

func TestCollectHAR_mergesBufferAndExternalFrame(t *testing.T) {
	// Both sources captured traffic: the in-process buffer (core) and an external __har__ frame.
	// collectHAR must merge them into one HAR document carrying both entries.
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, "http://core.example.com", nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)

	frameHAR := `{"log":{"entries":[{"request":{"url":"http://external/y"}}]}}`
	f := data.NewFrame("")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": frameHAR}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__": backend.DataResponse{Frames: data.Frames{f}}}}

	out, err := collectHAR(resp, buf)
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 2, "buffer entry + external frame entry are both present")
}

func TestCollectHAR_multipleDatasources_namespacedRefIDs(t *testing.T) {
	// Regression guard for the multi-datasource collision: the SDK namespaces the capture refId per
	// datasource ("__har__<uid>"), so a query spanning two external datasources yields two distinct
	// __har__-prefixed responses. collectHAR must collect BOTH (not just one) and consume both.
	frameA := data.NewFrame("__har__A")
	frameA.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[{"request":{"url":"http://a/1"}}]}}`}}
	frameB := data.NewFrame("__har__B")
	frameB.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[{"request":{"url":"http://b/1"}},{"request":{"url":"http://b/2"}}]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": backend.DataResponse{Frames: data.Frames{frameA}},
		"__har__B": backend.DataResponse{Frames: data.Frames{frameB}},
	}}

	out, err := collectHAR(resp, &harcapture.Buffer{})
	require.NoError(t, err)
	require.NotNil(t, out)

	var env struct {
		Log struct {
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}
	require.NoError(t, json.Unmarshal(out, &env))
	require.Len(t, env.Log.Entries, 3, "entries from BOTH datasources' capture frames are merged (1 + 2)")

	_, aKept := resp.Responses["__har__A"]
	_, bKept := resp.Responses["__har__B"]
	require.False(t, aKept || bKept, "all __har__-prefixed synthetic responses are consumed")
}

func TestHasCapturedHAR_namespacedRefID(t *testing.T) {
	f := data.NewFrame("__har__P123")
	f.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": `{"log":{"entries":[]}}`}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"__har__P123": backend.DataResponse{Frames: data.Frames{f}}}}
	require.True(t, HasCapturedHAR(resp, &harcapture.Buffer{}), "a datasource-namespaced capture frame counts as captured")
}

func TestResponseError_skipsNamespacedHARFrames(t *testing.T) {
	// Namespaced synthetic responses must be skipped by ResponseError (their error is read via
	// PluginCaptureError); a real per-refId error alongside them is still reported.
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": {Error: errors.New("swallowed A")},
		"__har__B": {Error: errors.New("swallowed B")},
		"C":        {Error: errors.New("real boom")},
	}}
	require.EqualError(t, ResponseError(resp), "C: real boom")
}

func TestPluginCaptureError_multipleDatasources(t *testing.T) {
	// Each external datasource can stash its own queryError under its namespaced frame; report all,
	// ordered deterministically.
	fa := data.NewFrame("__har__A")
	fa.Meta = &data.FrameMeta{Custom: map[string]interface{}{"queryError": "boom A"}}
	fb := data.NewFrame("__har__B")
	fb.Meta = &data.FrameMeta{Custom: map[string]interface{}{"queryError": "boom B"}}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__A": {Frames: data.Frames{fa}},
		"__har__B": {Frames: data.Frames{fb}},
	}}
	require.EqualError(t, PluginCaptureError(resp), "boom A\nboom B")
}

func TestBuildTarGz(t *testing.T) {
	blob, err := buildTarGz(map[string][]byte{"b.txt": []byte("bbb"), "a.txt": []byte("aaa")})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Equal(t, "aaa", string(files["a.txt"]))
	require.Equal(t, "bbb", string(files["b.txt"]))
}

func TestBuildTarGz_deterministicOrder(t *testing.T) {
	blob, err := buildTarGz(map[string][]byte{"b.txt": []byte("b"), "a.txt": []byte("a"), "c.txt": []byte("c")})
	require.NoError(t, err)

	gz, err := gzip.NewReader(bytes.NewReader(blob))
	require.NoError(t, err)
	tr := tar.NewReader(gz)
	var names []string
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		names = append(names, hdr.Name)
	}
	require.Equal(t, []string{"a.txt", "b.txt", "c.txt"}, names, "files written in sorted order")
}

func TestIndentJSON(t *testing.T) {
	require.Equal(t, "{\n  \"a\": 1\n}", string(indentJSON([]byte(`{"a":1}`))))
	require.Equal(t, "not json", string(indentJSON([]byte("not json"))), "falls back to raw bytes when unparseable")
}

func TestPluginCaptureError(t *testing.T) {
	require.NoError(t, PluginCaptureError(nil))
	require.NoError(t, PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}))

	// No queryError in the frame -> nil.
	noErr := data.NewFrame("__har__")
	noErr.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "{}"}}
	require.NoError(t, PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Frames: data.Frames{noErr}},
	}}))

	// queryError present -> surfaced.
	withErr := data.NewFrame("__har__")
	withErr.Meta = &data.FrameMeta{Custom: map[string]interface{}{"har": "{}", "queryError": "datasource boom"}}
	err := PluginCaptureError(&backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Frames: data.Frames{withErr}},
	}})
	require.EqualError(t, err, "datasource boom")
}

func TestResponseError_skipsSyntheticHARFrame(t *testing.T) {
	// The SDK sets an error on the synthetic __har__ response so its own middlewares see the failure;
	// ResponseError must not surface it under the reserved refID (PluginCaptureError handles it).
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"__har__": {Error: errors.New("swallowed boom")},
	}}
	require.NoError(t, ResponseError(resp), "__har__ synthetic error must be skipped")
	// A real per-refId error alongside it is still reported.
	resp.Responses["A"] = backend.DataResponse{Error: errors.New("real boom")}
	require.EqualError(t, ResponseError(resp), "A: real boom")
}

func TestResponseError(t *testing.T) {
	require.NoError(t, ResponseError(nil))
	require.NoError(t, ResponseError(&backend.QueryDataResponse{Responses: backend.Responses{"A": {}}}))

	sentinel := errors.New("boom")
	err := ResponseError(&backend.QueryDataResponse{Responses: backend.Responses{
		"B": {Error: sentinel},
		"A": {Error: errors.New("bad query")},
	}})
	require.Error(t, err)
	// Typed classification survives (handleQueryMetricsError relies on errors.Is).
	require.ErrorIs(t, err, sentinel)
	// Combined, wrapped per refId, and ordered deterministically by refId.
	require.Equal(t, "A: bad query\nB: boom", err.Error())
}

func bufferWithEntry(t *testing.T, url string) *harcapture.Buffer {
	t.Helper()
	buf := &harcapture.Buffer{}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	require.NoError(t, err)
	buf.AddEntry(req, nil, nil, time.Now(), time.Millisecond)
	return buf
}

func TestBuildDashboard(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 1, Title: "CPU Usage", PanelJSON: json.RawMessage(`{"id":1}`), Datasources: []string{"prom"}, HARBuffer: bufferWithEntry(t, "http://ds/1")},
		{ID: 2, Title: "Text panel", Skipped: "no queries (non-data panel)"},
	}
	blob, err := NewBundler().BuildDashboard(json.RawMessage(`{"title":"My dash"}`), panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "dashboard.json")
	require.Contains(t, files, "manifest.json")
	require.Contains(t, files, "panels/1-cpu-usage/panel.json")
	require.Contains(t, files, "panels/1-cpu-usage/traffic.har")
	require.NotContains(t, files, "server.log", "server log is intentionally omitted (not request-scoped)")
	// A skipped panel gets no dir.
	for name := range files {
		require.NotContains(t, name, "panels/2", "skipped panel must not have a dir")
	}

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 2, m.PanelsTotal)
	require.Equal(t, 1, m.PanelsRun, "only the data panel ran")
	require.Len(t, m.Panels, 2)
	require.Equal(t, "no queries (non-data panel)", m.Panels[1].Skipped)
	require.Equal(t, "panels/1-cpu-usage", m.Panels[0].Dir)
	require.Positive(t, m.Panels[0].HARBytes)
}

func TestBuildDashboard_recordsQueryDataPerPanel(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	panels := []DashboardPanel{{
		ID:           1,
		Title:        "CPU Usage",
		QueryRequest: json.RawMessage(`{"from":"now-1h","to":"now","queries":[{"refId":"A"}]}`),
		Resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Frames: data.Frames{frame}},
		}},
	}}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/querydata.json")
	require.Contains(t, string(files["panels/1-cpu-usage/querydata.json"]), `"refId": "A"`)
	require.Contains(t, string(files["panels/1-cpu-usage/querydata.json"]), `42`)
}

func TestBuildDashboard_writesSnapshotPerPanel(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	panels := []DashboardPanel{{
		ID:        1,
		Title:     "CPU Usage",
		PanelJSON: json.RawMessage(`{"id":1,"type":"timeseries"}`),
		Resp:      &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/snapshot-backend.json")
	snap := string(files["panels/1-cpu-usage/snapshot-backend.json"])
	require.Contains(t, snap, `"queryType": "snapshot"`)
	require.Contains(t, snap, "42", "baked value present")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Len(t, m.Panels, 1)
	require.Positive(t, m.Panels[0].SnapshotBackendBytes, "manifest records the snapshot size")
}

// The per-panel time range comes from that panel's own submitted request.
func TestBuildDashboard_snapshotBakesPanelTimeRange(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	panels := []DashboardPanel{{
		ID:           1,
		Title:        "CPU Usage",
		QueryRequest: json.RawMessage(`{"from":"1690000000000","to":"1690003600000","queries":[{"refId":"A"}]}`),
		Resp:         &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, string(files["panels/1-cpu-usage/snapshot-backend.json"]),
		`"from": "`+time.UnixMilli(1690000000000).UTC().Format(time.RFC3339Nano)+`"`)
}

// v2 dashboards post the save model once, so a panel's JSON is resolved from it as a {kind, spec}
// element -- the shape the snapshot has to translate rather than copy.
func TestBuildDashboard_snapshotFlattensV2ElementFromDashboardModel(t *testing.T) {
	dashboardJSON := json.RawMessage(`{"elements":{"panel-1":{"kind":"Panel","spec":{"id":1,"title":"CPU","vizConfig":{"kind":"VizConfig","group":"stat","version":"","spec":{"options":{},"fieldConfig":{}}}}}}}`)
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	panels := []DashboardPanel{{
		ID:    1,
		Title: "CPU",
		Resp:  &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}

	blob, err := NewBundler().BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	var dash struct {
		Panels []struct {
			Type string `json:"type"`
		} `json:"panels"`
	}
	require.NoError(t, json.Unmarshal(files["panels/1-cpu/snapshot-backend.json"], &dash))
	require.Equal(t, "stat", dash.Panels[0].Type)
	require.NotContains(t, string(files["panels/1-cpu/snapshot-backend.json"]), "vizConfig")
}

// The snapshot draws from what querydata.json left of the shared dashboard budget instead of getting
// a pool of its own, which would double the bundle's uncompressed ceiling for the same frames. Once
// the budget is spent the snapshot is dropped and the manifest says why.
func TestBuildDashboard_snapshotSharesQueryDataBudget(t *testing.T) {
	panels := make([]DashboardPanel, 0, 5)
	for i := 1; i <= 5; i++ {
		frame := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", maxQueryDataArtifactBytes-4096)}))
		panels = append(panels, DashboardPanel{
			ID:    int64(i),
			Title: "Logs",
			Resp: &backend.QueryDataResponse{Responses: backend.Responses{
				"A": {Frames: data.Frames{frame}},
			}},
		})
	}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	artifactBytes := 0
	for name, contents := range files {
		if strings.HasSuffix(name, "/querydata.json") || strings.HasSuffix(name, "/snapshot-backend.json") {
			artifactBytes += len(contents)
		}
	}
	require.LessOrEqual(t, artifactBytes, maxDashboardQueryDataBytes, "both artifacts share one budget")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	// Two distinct reasons a snapshot is dropped for budget, and the manifest has to tell them apart:
	// the artifact was built and didn't fit what was left, or the budget was already too spent to try.
	// Asserting only on "budget" would pass with either message, so neither path would be pinned. These
	// panels are large enough that the budget drains in ~8MB steps and never lands under the minimum,
	// so this fixture exercises the exceeded path; the default case fails on anything else.
	var exceeded, belowMinimum int
	for _, p := range m.Panels {
		switch {
		case p.SnapshotBackendError == "":
		case strings.Contains(p.SnapshotBackendError, "exceeded the remaining dashboard query-data budget"):
			exceeded++
		case strings.Contains(p.SnapshotBackendError, "below the"):
			belowMinimum++
		default:
			t.Fatalf("unexpected snapshotBackendError: %q", p.SnapshotBackendError)
		}
	}
	require.Positive(t, exceeded, "a snapshot that outgrew what the budget had left says so")
	require.Zero(t, belowMinimum)
}

// BuildDashboard's snapshot gate keys off having FRAMES, not a non-nil response, so that a panel with
// nothing to bake is never reported as one whose snapshot was dropped for budget. Tested directly: the
// difference only shows in the manifest once the shared budget has drained below the minimum artifact
// size, which takes ~32MB of artifacts to reach and is impractical to stage as a fixture.
func TestHasSnapshotFrames(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))

	for name, tc := range map[string]struct {
		resp *backend.QueryDataResponse
		want bool
	}{
		"nil response": {resp: nil, want: false},
		"error only, no frames": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Error: errors.New("datasource exploded")},
		}}, want: false},
		"empty frame slice": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Frames: data.Frames{}},
		}}, want: false},
		"only a nil frame": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Frames: data.Frames{nil}},
		}}, want: false},
		"capture frames only": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"__har__P1": {Frames: data.Frames{frame}},
		}}, want: false},
		"one real frame": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Frames: data.Frames{frame}},
		}}, want: true},
		"real frame beside a failed refID": {resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Error: errors.New("boom")},
			"B": {Frames: data.Frames{frame}},
		}}, want: true},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.want, hasSnapshotFrames(tc.resp))
		})
	}
}

// A panel whose queries all failed has a response but no frames: nothing to bake, which is not a
// snapshot failure. Nothing is written and the manifest stays silent about it -- the query failure is
// recorded as the panel's error, where a reader expects it.
func TestBuildDashboard_noSnapshotForFramelessResponse(t *testing.T) {
	panels := []DashboardPanel{{
		ID:    99,
		Title: "Broken",
		Resp: &backend.QueryDataResponse{Responses: backend.Responses{
			"A": {Error: errors.New("datasource exploded")},
		}},
	}}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.NotContains(t, files, "panels/99-broken/snapshot-backend.json")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Len(t, m.Panels, 1)
	require.Empty(t, m.Panels[0].SnapshotBackendError, "no frames to bake is not a snapshot failure")
	require.Zero(t, m.Panels[0].SnapshotBackendBytes)
}

func TestBuildDashboard_boundsAggregateQueryData(t *testing.T) {
	panels := make([]DashboardPanel, 0, 5)
	for i := 1; i <= 5; i++ {
		frame := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", maxQueryDataArtifactBytes-4096)}))
		panels = append(panels, DashboardPanel{
			ID:    int64(i),
			Title: "Logs",
			Resp: &backend.QueryDataResponse{Responses: backend.Responses{
				"A": {Frames: data.Frames{frame}},
			}},
		})
	}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryDataBytes := 0
	for name, contents := range files {
		if strings.HasSuffix(name, "/querydata.json") {
			queryDataBytes += len(contents)
		}
	}
	require.LessOrEqual(t, queryDataBytes, maxDashboardQueryDataBytes)
	require.Contains(t, string(files["manifest.json"]), `"queryDataTruncated": true`)
}

// The whole-dashboard client posts the dashboard save model once instead of each panel's JSON, so
// BuildDashboard must resolve each panel's panel.json from that model by id -- including panels nested
// inside a collapsed row.
func TestBuildDashboard_resolvesPanelJSONFromDashboardModel(t *testing.T) {
	dashboardJSON := json.RawMessage(`{
		"title": "My dash",
		"panels": [
			{"id": 1, "type": "timeseries", "title": "CPU Usage"},
			{"id": 9, "type": "row", "title": "Row", "panels": [
				{"id": 2, "type": "logs", "title": "Logs"}
			]}
		]
	}`)
	// Neither panel carries inline PanelJSON -- it must be extracted from dashboardJSON by id.
	panels := []DashboardPanel{
		{ID: 1, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/1")},
		{ID: 2, Title: "Logs", HARBuffer: bufferWithEntry(t, "http://ds/2")},
	}
	blob, err := NewBundler().BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu-usage/panel.json", "top-level panel JSON resolved by id")
	require.Contains(t, files, "panels/2-logs/panel.json", "panel nested in a collapsed row resolved by id")
	require.Contains(t, string(files["panels/1-cpu-usage/panel.json"]), `"timeseries"`)
	require.Contains(t, string(files["panels/2-logs/panel.json"]), `"logs"`)
}

func TestBuildDashboard_resolvesPanelJSONFromDashboardV2Model(t *testing.T) {
	dashboardJSON := json.RawMessage(`{
		"title": "My dash",
		"elements": {
			"panel-3": {
				"kind": "Panel",
				"spec": {"id": 3, "title": "CPU Usage", "vizConfig": {"group": "timeseries"}}
			},
			"panel-4": {
				"kind": "LibraryPanel",
				"spec": {"id": 4, "title": "Shared Errors", "libraryPanel": {"uid": "shared-errors"}}
			}
		}
	}`)
	panels := []DashboardPanel{
		{ID: 3, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/3")},
		{ID: 4, Title: "Shared Errors", HARBuffer: bufferWithEntry(t, "http://ds/4")},
	}
	blob, err := NewBundler().BuildDashboard(dashboardJSON, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-cpu-usage/panel.json")
	require.Contains(t, files, "panels/4-shared-errors/panel.json")
	require.Contains(t, string(files["panels/3-cpu-usage/panel.json"]), `"timeseries"`)
	require.Contains(t, string(files["panels/4-shared-errors/panel.json"]), `"shared-errors"`)
}

func TestIndexPanelJSON(t *testing.T) {
	dash := json.RawMessage(`{"panels":[{"id":1,"type":"a"},{"id":5,"type":"row","panels":[{"id":6,"type":"b"}]}]}`)
	panelsByID := indexPanelJSON(dash)
	require.Contains(t, string(panelsByID[1]), `"a"`)
	require.Contains(t, string(panelsByID[6]), `"b"`, "must index panels nested in a row")
	require.NotContains(t, panelsByID, int64(99), "unknown id is omitted")
	require.Empty(t, indexPanelJSON(nil), "empty dashboard produces an empty index")
	require.Empty(t, indexPanelJSON(json.RawMessage(`not json`)), "malformed dashboard produces an empty index")
}

func TestBuildDashboard_recordsPanelQueryError(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 7, Title: "Broken", QueryErr: errors.New("datasource exploded")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/7-broken/query-error.txt")
	require.Contains(t, string(files["panels/7-broken/query-error.txt"]), "datasource exploded")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 0, m.PanelsRun, "a panel whose query errored is not counted as run")
	require.Equal(t, "datasource exploded", m.Panels[0].Error)
}

func TestBuildDashboard_dirCollision(t *testing.T) {
	// Two panels share an id+title, so their dirs must be disambiguated.
	panels := []DashboardPanel{
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/a")},
		{ID: 3, Title: "Same", HARBuffer: bufferWithEntry(t, "http://ds/b")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/3-same/traffic.har")
	require.Contains(t, files, "panels/3-same-2/traffic.har", "collision disambiguated with a numeric suffix")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Equal(t, 2, m.PanelsTotal)
}

// A panel whose MetricRequest can't be serialized must not abort the whole archive: the failure is
// recorded against the panel and the other panels' artifacts survive.
func TestBuildDashboard_recordsQueryRequestError(t *testing.T) {
	panels := []DashboardPanel{
		{ID: 1, Title: "Broken request", QueryRequestErr: errors.New("unsupported value: NaN")},
		{ID: 2, Title: "CPU Usage", HARBuffer: bufferWithEntry(t, "http://ds/2")},
	}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/2-cpu-usage/traffic.har", "the healthy panel's artifacts survive")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "serialize query request")
	require.Contains(t, m.Panels[0].QueryDataError, "unsupported value: NaN")
}

// A panel that hits two query-data failures keeps both in the manifest: the request-serialize failure
// explains the missing request, so a later response-marshal failure must not replace it.
func TestBuildDashboard_joinsQueryDataErrors(t *testing.T) {
	// Metadata that cannot be JSON-encoded makes the response marshal fail after the request already
	// failed to serialize.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	panels := []DashboardPanel{{
		ID:              1,
		Title:           "Broken both ways",
		QueryRequestErr: errors.New("request: unsupported value: +Inf"),
		Resp:            &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	// The response could not be encoded and the request never serialized, so the artifact keeps only the
	// frame summary -- but it still ships, because that summary is all the query data there is.
	queryData := string(files["panels/1-broken-both-ways/querydata.json"])
	require.Contains(t, queryData, `"responseOmitted": true`)
	require.Contains(t, queryData, `"rows": 1`)
	require.NotContains(t, queryData, `"request"`, "the request never serialized")

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "serialize query request: request: unsupported value: +Inf")
	require.Contains(t, m.Panels[0].QueryDataError, "data.FrameMeta.Custom: unsupported value: NaN")
}

func TestBundler_Build_keepsRequestWhenResponseEncodingFails(t *testing.T) {
	// A response the SDK cannot encode (unserializable frame metadata) must not take a perfectly
	// serializable request down with it: that request is the query a support engineer needs most in
	// exactly the hard-to-encode cases this artifact exists for.
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}
	request := json.RawMessage(`{"queries":[{"refId":"A","expr":"up"}]}`)

	blob, err := NewBundler().Build(resp, &harcapture.Buffer{}, nil, nil, request, nil, nil)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := string(files["querydata.json"])
	require.Contains(t, queryData, `"expr": "up"`, "the serializable request survives")
	require.Contains(t, queryData, `"responseOmitted": true`)
	require.Contains(t, queryData, `"responseError"`, "the encode failure is explained in the artifact")
	require.Contains(t, queryData, `"rows": 1`, "the frame summary stands in for the response")
	require.NotContains(t, queryData, `"truncated"`, "this is an encode failure, not a size truncation")

	// The failure is still recorded alongside the degraded artifact rather than swallowed by it.
	require.Contains(t, string(files["querydata-error.txt"]), "unsupported value: NaN")
}

func TestBuildDashboard_keepsRequestWhenResponseEncodingFails(t *testing.T) {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: math.NaN()}
	panels := []DashboardPanel{{
		ID:           1,
		Title:        "Broken response",
		QueryRequest: json.RawMessage(`{"queries":[{"refId":"A","expr":"up"}]}`),
		Resp:         &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}},
	}}
	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	queryData := string(files["panels/1-broken-response/querydata.json"])
	require.Contains(t, queryData, `"expr": "up"`, "the serializable request survives")
	require.Contains(t, queryData, `"responseOmitted": true`)

	var m dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &m))
	require.Contains(t, m.Panels[0].QueryDataError, "unsupported value: NaN")
	require.NotZero(t, m.Panels[0].QueryDataBytes, "the surviving artifact is accounted for in the manifest")
}

func TestMarshalQueryDataArtifactWithLimit_encodeFailureFitsMinimumBudget(t *testing.T) {
	// The BuildDashboard budget gate assumes the smallest artifact fits in minQueryDataArtifactBytes.
	// An encode failure adds responseError, which must not push the floor past that assumption --
	// otherwise a panel reaching the gate with a near-exhausted budget loses everything again.
	resp := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{frameWithUnencodableMeta(longMarshalError)}},
	}}
	request := json.RawMessage(`{"queries":[{"refId":"A","expr":"` + strings.Repeat("x", 4096) + `"}]}`)

	out, _, err := marshalQueryDataArtifactWithLimit(request, resp, minQueryDataArtifactBytes)
	require.Error(t, err, "the response still fails to encode")
	require.NotEmpty(t, out, "a floor artifact is produced rather than nothing")
	require.LessOrEqual(t, len(out), minQueryDataArtifactBytes)

	var artifact queryDataArtifact
	require.NoError(t, json.Unmarshal(out, &artifact), "the floor artifact is valid JSON")
	require.Equal(t, queryDataArtifactVersion, artifact.Version)
	require.True(t, artifact.ResponseOmitted)
	require.True(t, artifact.RequestOmitted)
}

// longMarshalError stands in for a plugin whose own MarshalJSON fails with a verbose message: the
// error text embedded in the artifact is plugin-controlled and can dwarf the artifact's own markers.
var longMarshalError = strings.Repeat("boom ", 400)

type failingMarshaler struct{ msg string }

func (f failingMarshaler) MarshalJSON() ([]byte, error) { return nil, errors.New(f.msg) }

func frameWithUnencodableMeta(msg string) *data.Frame {
	frame := data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))
	frame.Meta = &data.FrameMeta{Custom: failingMarshaler{msg: msg}}
	return frame
}

func TestSummarizeQueryDataResponse_errorWithoutStatus(t *testing.T) {
	// Core datasources run in-process, so nothing normalizes their status the way the SDK does on the
	// gRPC boundary; several return a bare DataResponse{Error: ...}. Reporting 200 beside an error
	// string would tell a support engineer the query succeeded.
	summaries := summarizeQueryDataResponse(&backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Error: errors.New("influxdb: parse error")},
		"B": {Frames: data.Frames{data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))}},
		"C": {Status: backend.StatusBadRequest, Error: errors.New("bad query")},
	}})

	require.Equal(t, backend.StatusUnknown, summaries["A"].Status, "an errored response must not be summarized as OK")
	require.Contains(t, summaries["A"].Error, "parse error")
	require.Equal(t, backend.StatusOK, summaries["B"].Status, "an error-free response with no status is still OK")
	require.Equal(t, backend.StatusBadRequest, summaries["C"].Status, "an explicit status is preserved")
}

func TestTruncateDiagnosticString_runeBoundary(t *testing.T) {
	// A single "世" is 3 bytes; a 4-byte limit lands mid-rune and must back off to the boundary.
	got := truncateDiagnosticString("世界", 4)
	require.True(t, utf8.ValidString(got), "truncation must not split a rune")
	require.Equal(t, "世"+"…", got)

	// ASCII within the limit is returned untouched.
	require.Equal(t, "hello", truncateDiagnosticString("hello", 10))
}

func TestMarshalQueryDataArtifactWithLimit_reportsTruncation(t *testing.T) {
	frame := data.NewFrame("logs", data.NewField("line", nil, []string{strings.Repeat("x", maxQueryDataArtifactBytes)}))
	resp := &backend.QueryDataResponse{Responses: backend.Responses{"A": {Frames: data.Frames{frame}}}}

	_, truncated, err := marshalQueryDataArtifactWithLimit(nil, resp, maxQueryDataArtifactBytes)
	require.NoError(t, err)
	require.True(t, truncated, "an oversized response must report truncated=true")

	small := &backend.QueryDataResponse{Responses: backend.Responses{
		"A": {Frames: data.Frames{data.NewFrame("cpu", data.NewField("value", nil, []float64{42}))}},
	}}
	_, truncated, err = marshalQueryDataArtifactWithLimit(nil, small, maxQueryDataArtifactBytes)
	require.NoError(t, err)
	require.False(t, truncated, "a response that fits must report truncated=false")
}

func readTarGz(t *testing.T, data []byte) map[string][]byte {
	t.Helper()

	gz, err := gzip.NewReader(bytes.NewReader(data))
	require.NoError(t, err)

	tr := tar.NewReader(gz)
	out := map[string][]byte{}
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		require.NoError(t, err)
		b, err := io.ReadAll(tr)
		require.NoError(t, err)
		out[hdr.Name] = b
	}
	return out
}
