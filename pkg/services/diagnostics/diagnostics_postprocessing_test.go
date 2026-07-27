package diagnostics

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

// postProcessingPayload builds a plausible frontend pipeline capture: a small transformation config
// and display context beside frames of the requested size, which is the shape the size ladder in
// fitPostProcessingArtifact is built around.
func postProcessingPayload(t *testing.T, frameBytes int) json.RawMessage {
	t.Helper()
	return json.RawMessage(fmt.Sprintf(
		`{"transformations":[{"id":"reduce","options":{"reducers":["mean"]}}],`+
			`"input":[{"schema":{"name":"in"},"data":{"values":[["%s"]]}}],`+
			`"output":[{"schema":{"name":"out"}}],`+
			`"display":{"pluginId":"timeseries"}}`,
		strings.Repeat("x", frameBytes)))
}

func TestBundler_Build_recordsFrontendProcessing(t *testing.T) {
	pp := json.RawMessage(`{"transformations":[{"id":"reduce","options":{}}],` +
		`"input":[{"schema":{"name":"in"}}],"output":[{"schema":{"name":"out"}}],` +
		`"display":{"pluginId":"timeseries"}}`)

	blob, err := NewBundler().Build(BuildInput{HARBuffer: &harcapture.Buffer{}, PostProcessing: pp})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "frontend-processing.json")
	body := string(files["frontend-processing.json"])
	require.Contains(t, body, `"transformations"`)
	require.Contains(t, body, `"reduce"`)
	require.Contains(t, body, `"input"`)
	require.Contains(t, body, `"output"`)
	require.Contains(t, body, `"timeseries"`)
	require.NotContains(t, body, `"truncated"`, "an artifact that fits carries no truncation markers")
}

func TestBundler_Build_omitsEmptyFrontendProcessing(t *testing.T) {
	for _, raw := range []json.RawMessage{nil, json.RawMessage(""), json.RawMessage("  "), json.RawMessage("null")} {
		blob, err := NewBundler().Build(BuildInput{HARBuffer: &harcapture.Buffer{}, PanelJSON: json.RawMessage(`{"id":1}`), PostProcessing: raw})
		require.NoError(t, err)
		files := readTarGz(t, blob)
		require.NotContains(t, files, "frontend-processing.json",
			"no artifact when the client sent no post-processing evidence (%q)", string(raw))
	}
}

// TestMarshalPostProcessingArtifact_keepsTransformConfigWhenFramesDropped is the core of the size
// ladder: the frames are the bulk, but the transformation config and display context are what let a
// reader decide "wrong frontend transform" vs "bad datasource data", so an over-budget payload must
// not degrade to a bare marker that answers neither.
func TestMarshalPostProcessingArtifact_keepsTransformConfigWhenFramesDropped(t *testing.T) {
	pp := postProcessingPayload(t, 4096)

	out, truncated := marshalPostProcessingArtifact(pp, 1024)
	require.True(t, truncated)
	require.NotEmpty(t, out)
	require.LessOrEqual(t, len(out), 1024)

	var artifact postProcessingArtifact
	require.NoError(t, json.Unmarshal(out, &artifact), "the degraded artifact is valid JSON")
	require.Equal(t, postProcessingArtifactVersion, artifact.Version)
	require.True(t, artifact.Truncated)
	require.True(t, artifact.FramesOmitted)
	require.JSONEq(t, `[{"id":"reduce","options":{"reducers":["mean"]}}]`, string(artifact.Transformations),
		"the transformation config survives verbatim")
	require.JSONEq(t, `{"pluginId":"timeseries"}`, string(artifact.Display), "the display context survives verbatim")
	require.False(t, artifact.TransformationsOmitted)
	require.False(t, artifact.DisplayOmitted)

	require.NotContains(t, string(out), strings.Repeat("x", 100), "the oversized frames are not embedded")
	require.Equal(t, 1024, artifact.LimitBytes)
	require.Equal(t, len(pp), artifact.OriginalBytes, "originalBytes is the payload as received")
	require.Greater(t, artifact.IndentedBytes, 1024, "indentedBytes is what the limit was compared against")
}

// TestMarshalPostProcessingArtifact_dropsSmallFieldsWhenBudgetTiny walks the remaining rungs: display
// goes before the transformation config, and the marker-only floor is still valid JSON.
func TestMarshalPostProcessingArtifact_dropsSmallFieldsWhenBudgetTiny(t *testing.T) {
	pp := json.RawMessage(`{"transformations":[{"id":"reduce","options":{"reducers":["mean","max","min"]}}],` +
		`"input":[{"data":"` + strings.Repeat("x", 2000) + `"}],` +
		`"display":{"pluginId":"timeseries","fieldConfig":{"overrides":[{"matcher":{"id":"byName"}}]}}}`)

	// Enough room for the transformation config alone, but not alongside the display context.
	out, truncated := marshalPostProcessingArtifact(pp, 400)
	require.True(t, truncated)
	require.LessOrEqual(t, len(out), 400)

	var artifact postProcessingArtifact
	require.NoError(t, json.Unmarshal(out, &artifact))
	require.NotEmpty(t, artifact.Transformations, "the transformation config is the last thing dropped")
	require.Empty(t, artifact.Display)
	require.True(t, artifact.DisplayOmitted, "a dropped display context is distinguishable from one never sent")

	// Below the floor nothing but markers fits, and that floor must still parse.
	floor, truncated := marshalPostProcessingArtifact(pp, 200)
	require.True(t, truncated)
	require.NotEmpty(t, floor)
	var bare postProcessingArtifact
	require.NoError(t, json.Unmarshal(floor, &bare), "the marker-only floor is valid JSON")
	require.Equal(t, postProcessingArtifactVersion, bare.Version)
	require.True(t, bare.Truncated)
	require.True(t, bare.FramesOmitted)
	require.True(t, bare.TransformationsOmitted)
	require.True(t, bare.DisplayOmitted)
	require.Empty(t, bare.Transformations)
	require.Less(t, len(floor), minDiagnosticArtifactBytes,
		"the floor stays under the minimum-budget gate, so that gate remains meaningful")
}

// TestMarshalPostProcessingArtifact_nonObjectPayload guards the ladder against a payload that isn't a
// JSON object: there is no separable small part, so it must fall to markers rather than error out.
func TestMarshalPostProcessingArtifact_nonObjectPayload(t *testing.T) {
	pp := json.RawMessage(`["` + strings.Repeat("x", 2000) + `"]`)

	out, truncated := marshalPostProcessingArtifact(pp, 512)
	require.True(t, truncated)

	var artifact postProcessingArtifact
	require.NoError(t, json.Unmarshal(out, &artifact))
	require.True(t, artifact.Truncated)
	require.Empty(t, artifact.Transformations)
	require.False(t, artifact.TransformationsOmitted, "nothing was sent to omit")
	require.NotContains(t, string(out), strings.Repeat("x", 100))
}

// ---- whole-dashboard path -----------------------------------------------------------------------

func TestBundler_BuildDashboard_recordsFrontendProcessingPerPanel(t *testing.T) {
	blob, err := NewBundler().BuildDashboard(nil, []DashboardPanel{
		{ID: 1, Title: "CPU", PostProcessing: json.RawMessage(`{"transformations":[{"id":"reduce"}]}`)},
		{ID: 2, Title: "Memory", PostProcessing: json.RawMessage(`{"display":{"pluginId":"stat"}}`)},
		{ID: 3, Title: "No evidence"},
	})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	require.Contains(t, files, "panels/1-cpu/frontend-processing.json")
	require.Contains(t, files, "panels/2-memory/frontend-processing.json")
	require.NotContains(t, files, "panels/3-no-evidence/frontend-processing.json",
		"a panel whose client sent no evidence gets no artifact")
	require.Contains(t, string(files["panels/1-cpu/frontend-processing.json"]), `"reduce"`)
	require.Contains(t, string(files["panels/2-memory/frontend-processing.json"]), `"stat"`)

	byID := manifestPanelsByID(t, files)
	require.Positive(t, byID[1].PostProcessingBytes, "the manifest records the artifact size")
	require.False(t, byID[1].PostProcessingTruncated)
	require.Empty(t, byID[1].PostProcessingError)
	require.Zero(t, byID[3].PostProcessingBytes, "a panel with no evidence records no bytes")
}

// TestBundler_BuildDashboard_boundsTotalFrontendProcessing is the reason the dashboard-wide budget
// exists: a per-panel cap alone lets N panels multiply into the whole archive, since every panel's
// artifact is held in memory at once while the tarball is assembled.
func TestBundler_BuildDashboard_boundsTotalFrontendProcessing(t *testing.T) {
	// Sized to stay under the per-panel cap (so panel 1 is written in full) while 12 of them together
	// overrun the dashboard-wide pool -- otherwise the per-panel cap, not the pool, would be what bounds
	// the total and the test would pass without exercising the budget at all.
	const panelCount = 12
	const frameBytes = maxDashboardPostProcessingBytes / 8
	require.Less(t, frameBytes, maxQueryDataArtifactBytes, "each panel must fit its own cap")
	require.Greater(t, panelCount*frameBytes, maxDashboardPostProcessingBytes, "together they must overrun the pool")

	panels := make([]DashboardPanel, 0, panelCount)
	for i := range panelCount {
		panels = append(panels, DashboardPanel{
			ID:             int64(i + 1),
			Title:          fmt.Sprintf("panel %d", i+1),
			PostProcessing: postProcessingPayload(t, frameBytes),
		})
	}

	blob, err := NewBundler().BuildDashboard(nil, panels)
	require.NoError(t, err)

	files := readTarGz(t, blob)
	total := 0
	for name, body := range files {
		if strings.HasSuffix(name, "/frontend-processing.json") {
			total += len(body)
		}
	}
	require.LessOrEqual(t, total, maxDashboardPostProcessingBytes,
		"the total across panels stays within the dashboard-wide budget")

	// The panels that ran out of budget must say so rather than silently shipping nothing, and the
	// early panels must still carry their full evidence.
	byID := manifestPanelsByID(t, files)
	require.Positive(t, byID[1].PostProcessingBytes, "the first panel fits and is written in full")
	require.False(t, byID[1].PostProcessingTruncated)

	degraded := 0
	for _, entry := range byID {
		if entry.PostProcessingTruncated || entry.PostProcessingError != "" {
			degraded++
		}
	}
	require.Positive(t, degraded, "panels past the budget are recorded as truncated or errored")

	// Query data has its own pool, so exhausting the post-processing budget must not touch it.
	require.Empty(t, byID[panelCount].QueryDataError)
}

// TestBundler_BuildDashboard_perPanelCapStillApplies checks the per-panel cap is enforced alongside
// the dashboard-wide pool: one enormous panel degrades on its own, without consuming the whole pool.
func TestBundler_BuildDashboard_perPanelCapStillApplies(t *testing.T) {
	blob, err := NewBundler().BuildDashboard(nil, []DashboardPanel{
		{ID: 1, Title: "huge", PostProcessing: postProcessingPayload(t, maxQueryDataArtifactBytes+1024)},
		{ID: 2, Title: "small", PostProcessing: json.RawMessage(`{"transformations":[{"id":"reduce"}]}`)},
	})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	byID := manifestPanelsByID(t, files)
	require.True(t, byID[1].PostProcessingTruncated, "the oversized panel is truncated by the per-panel cap")
	require.LessOrEqual(t, byID[1].PostProcessingBytes, maxQueryDataArtifactBytes)
	require.Contains(t, string(files["panels/1-huge/frontend-processing.json"]), `"reduce"`,
		"the truncated artifact still carries the transformation config")

	require.False(t, byID[2].PostProcessingTruncated, "a later small panel is unaffected")
	require.Contains(t, files, "panels/2-small/frontend-processing.json")
}

// TestBundler_BuildDashboard_recordsDiscardedPostProcessingForSkippedPanel pins the one case where
// evidence is intentionally dropped: a skipped panel has no directory to write it to, so the loss
// must at least be visible in the manifest.
func TestBundler_BuildDashboard_recordsDiscardedPostProcessingForSkippedPanel(t *testing.T) {
	blob, err := NewBundler().BuildDashboard(nil, []DashboardPanel{
		{ID: 1, Title: "Text", Skipped: "no queries (non-data panel)",
			PostProcessing: json.RawMessage(`{"display":{"pluginId":"text"}}`)},
		{ID: 2, Title: "Row", Skipped: "no queries (non-data panel)"},
	})
	require.NoError(t, err)

	files := readTarGz(t, blob)
	for name := range files {
		require.NotContains(t, name, "frontend-processing.json", "a skipped panel has no directory")
	}

	byID := manifestPanelsByID(t, files)
	require.Contains(t, byID[1].PostProcessingError, "discarded")
	require.Empty(t, byID[2].PostProcessingError, "a skipped panel that sent nothing records nothing")
}

// manifestPanelsByID decodes manifest.json and indexes its panel entries by id.
func manifestPanelsByID(t *testing.T, files map[string][]byte) map[int64]manifestPanelEntry {
	t.Helper()
	require.Contains(t, files, "manifest.json")
	var manifest dashboardManifest
	require.NoError(t, json.Unmarshal(files["manifest.json"], &manifest))
	byID := make(map[int64]manifestPanelEntry, len(manifest.Panels))
	for _, entry := range manifest.Panels {
		byID[entry.ID] = entry
	}
	return byID
}
