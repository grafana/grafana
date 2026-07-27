// Package diagnostics assembles on-demand datasource diagnostic bundles: captured HTTP traffic
// (HAR), QueryData request/results, and the panel/dashboard JSON. The HTTP handler in pkg/api runs
// the queries with capture active and delegates bundle assembly here.
package diagnostics

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

// Bundler assembles diagnostic bundles.
type Bundler struct{}

// Query responses can contain substantially more data than the diagnostic traffic itself. Keep
// their uncompressed JSON bounded independently so adding querydata.json cannot multiply a large
// panel/dashboard archive without an explicit truncation marker.
//
// querydata.json and snapshot-backend.json hold the same frames twice, so how the two are bounded
// together differs by path, deliberately:
//
//   - BuildDashboard draws both from one shared maxDashboardQueryDataBytes pool. It has a single
//     running budget spanning every panel, so letting the snapshot claim an allowance of its own
//     would double the whole archive's ceiling for data querydata.json already holds.
//   - Build has no running budget -- one panel, one shot -- and applies maxQueryDataArtifactBytes to
//     each artifact separately, so a single-panel bundle's real ceiling is twice that. Sharing one
//     allowance here would instead drop the snapshot whenever querydata.json had spent most of it,
//     losing the offline render on exactly the large responses it exists to make readable.
const (
	maxQueryDataArtifactBytes  = 8 << 20
	maxDashboardQueryDataBytes = 32 << 20
	// minQueryDataArtifactBytes is the smallest budget worth attempting: below it not even a truncated
	// artifact (version + omission markers) fits, so the panel's query data is skipped up front.
	//
	// The snapshot gate in BuildDashboard reuses it as a floor even though the snapshot has no
	// truncated form and its own minimum (schemaVersion + title + an empty panel + target) is nearer
	// 600 bytes. Deliberately loose: the gate exists to avoid re-encoding a whole response once per
	// remaining panel with no budget left, and a too-low floor only costs one encode that is then
	// measured and reported as over-budget -- whereas a floor tuned to the empty-snapshot size would
	// have to track every change to the dashboard scaffold to stay correct.
	minQueryDataArtifactBytes = 256
)

// grafanaSnapshotDatasourceRef returns the built-in Grafana datasource ref that serves baked snapshot
// frames offline: a snapshot panel points here so it renders with no live datasource and no query
// re-run. "grafana" is the built-in plugin's id, so it is the ref's type as well as its uid -- the
// same ref HelpWizard's debug dashboard uses for its snapshot targets (see
// public/app/features/dashboard-scene/inspect/HelpWizard/utils.ts).
//
// A fresh map per call: the result is embedded in both the panel and its target, and a shared
// package-level map would alias the two (and be mutable from anywhere in the package).
func grafanaSnapshotDatasourceRef() map[string]any {
	return map[string]any{"type": "grafana", "uid": "grafana", "name": "grafana"}
}

// queryDataArtifactVersion is the schema version stamped into every querydata.json (including its
// truncated fallbacks) so a reader can tell how to interpret the artifact.
const queryDataArtifactVersion = 1

// NewBundler returns a Bundler.
func NewBundler() *Bundler {
	return &Bundler{}
}

// Build assembles a .tar.gz bundle from the query response, the captured HAR buffer, and the
// optional panel/dashboard JSON the client supplied. traffic.har is omitted when nothing was
// captured.
//
// Server logs are intentionally omitted because they are not scoped to this request and would leak
// unrelated activity into a bundle meant for external sharing; they will be tackled in a follow-up.
func (b *Bundler) Build(resp *backend.QueryDataResponse, harBuffer *harcapture.Buffer, panelJSON, dashboardJSON, queryRequestJSON json.RawMessage, queryRequestErr, queryErr error) ([]byte, error) {
	files := map[string][]byte{}

	// queryRequestErr is the caller's failure to serialize the request into queryRequestJSON. Record it
	// so a support engineer can tell the request JSON was omitted because serialization failed rather
	// than silently dropped, mirroring how the per-panel dashboard path records manifest.queryDataError.
	var queryDataErr error
	if queryRequestErr != nil {
		queryDataErr = fmt.Errorf("serialize query request: %w", queryRequestErr)
	}
	if resp != nil || len(queryRequestJSON) > 0 {
		queryData, err := marshalQueryDataArtifact(queryRequestJSON, resp)
		if err != nil {
			// A query-data artifact that cannot be fully JSON-encoded must not sink the whole bundle:
			// record the failure and still ship HAR and the other artifacts, mirroring how the dashboard
			// path degrades per panel via manifest.queryDataError.
			queryDataErr = errors.Join(queryDataErr, err)
		}
		// An unencodable response still leaves a degraded artifact (request plus frame summary), so ship
		// whatever survived rather than discarding it along with the error.
		if len(queryData) > 0 {
			files["querydata.json"] = queryData
		}
	}
	if queryDataErr != nil {
		files["querydata-error.txt"] = []byte(queryDataErr.Error() + "\n")
	}

	// snapshot-backend.json: an importable, data-baked dashboard that renders the plugin's returned
	// frames offline (no datasource). A convenience artifact -- querydata.json remains the authoritative
	// record -- so a failure or an over-budget artifact costs only the snapshot. Why it went missing is
	// recorded in snapshot-backend-error.txt, mirroring how the dashboard path records
	// manifest.snapshotBackendError: omitting it silently leaves a reader unable to tell a failure from
	// a response with no frames.
	//
	// Named for the artifact rather than "snapshot" generically, because the rendered (post-transform)
	// counterpart lands as snapshot-rendered.json and needs a failure record of its own.
	//
	// Encoded in full before it is measured: like querydata.json above (see the note on its allocation
	// cost) an oversized response is built and then discarded, and the snapshot's frame slice plus the
	// indented dashboard around it are a second and third copy on top of that peak. Acceptable while
	// this is experimental, server-admin-only, and off by default; a streaming size check would be the
	// fix if it ever ships more widely.
	snapshot, snapshotErr := marshalSnapshotBackendArtifact(panelJSON, queryRequestJSON, resp)
	switch {
	case snapshotErr != nil:
		files["snapshot-backend-error.txt"] = []byte(snapshotErr.Error() + "\n")
	case len(snapshot) > maxQueryDataArtifactBytes:
		files["snapshot-backend-error.txt"] = []byte(fmt.Sprintf("snapshot-backend artifact (%d bytes) exceeded the %d-byte limit\n", len(snapshot), maxQueryDataArtifactBytes))
	case len(snapshot) > 0:
		files["snapshot-backend.json"] = snapshot
	}

	har, err := collectHAR(resp, harBuffer)
	if err != nil {
		return nil, err
	}
	if len(har) > 0 {
		files["traffic.har"] = har
	}

	if len(panelJSON) > 0 {
		files["panel.json"] = indentJSON(panelJSON)
	}
	if len(dashboardJSON) > 0 {
		files["dashboard.json"] = indentJSON(dashboardJSON)
	}

	if queryErr != nil {
		// Recorded verbatim -- redaction is intentionally deferred for this experimental feature
		// (see the harcapture package doc); the error text can embed a request URL with credentials.
		files["query-error.txt"] = []byte(queryErr.Error() + "\n")
	}

	return buildTarGz(files)
}

type queryDataArtifact struct {
	Version         int                                 `json:"version"`
	Request         json.RawMessage                     `json:"request,omitempty"`
	Response        json.RawMessage                     `json:"response,omitempty"`
	ResponseSummary map[string]queryDataResponseSummary `json:"responseSummary,omitempty"`
	// ResponseError records why the full response is missing when it could not be JSON-encoded, so a
	// reader can tell an unencodable response from one that was dropped to fit the size cap.
	ResponseError   string `json:"responseError,omitempty"`
	Truncated       bool   `json:"truncated,omitempty"`
	LimitBytes      int    `json:"limitBytes,omitempty"`
	OriginalBytes   int    `json:"originalBytes,omitempty"`
	RequestOmitted  bool   `json:"requestOmitted,omitempty"`
	ResponseOmitted bool   `json:"responseOmitted,omitempty"`
}

type queryDataResponseSummary struct {
	RefID       string                  `json:"refId"`
	Status      backend.Status          `json:"status"`
	Error       string                  `json:"error,omitempty"`
	ErrorSource backend.ErrorSource     `json:"errorSource,omitempty"`
	Frames      []queryDataFrameSummary `json:"frames,omitempty"`
}

type queryDataFrameSummary struct {
	Name   string `json:"name,omitempty"`
	RefID  string `json:"refId,omitempty"`
	Rows   int    `json:"rows"`
	Fields int    `json:"fields"`
}

func marshalQueryDataArtifact(request json.RawMessage, resp *backend.QueryDataResponse) ([]byte, error) {
	data, _, err := marshalQueryDataArtifactWithLimit(request, resp, maxQueryDataArtifactBytes)
	return data, err
}

// marshalQueryDataArtifactWithLimit returns the encoded querydata.json plus whether it had to drop
// content to fit maxBytes, so callers don't have to re-parse the result to learn that.
func marshalQueryDataArtifactWithLimit(request json.RawMessage, resp *backend.QueryDataResponse, maxBytes int) ([]byte, bool, error) {
	artifact := queryDataArtifact{Version: queryDataArtifactVersion, Request: request}
	if resp != nil {
		// The SDK encoder returns a complete byte slice. The artifact/archive is bounded below, but
		// serializing an oversized response can still temporarily allocate its full JSON size.
		responseJSON, err := queryDataResponseWithoutCaptureFrames(resp).MarshalJSON()
		if err != nil {
			// A response that cannot be encoded (e.g. an unserializable value in a frame's Meta.Custom)
			// usually still has a serializable request beside it. Degrade to the same request + summary
			// shape the size cap uses instead of dropping both -- losing the submitted query in exactly
			// the hard-to-encode cases this artifact exists to capture defeats its purpose.
			//
			// The error is returned as well, so both callers record it outside the artifact
			// (querydata-error.txt, manifest.queryDataError). That makes the embedded copy a convenience:
			// bound it by the budget so a verbose plugin error cannot crowd out the request, which is
			// recorded nowhere else.
			out, fallbackErr := fitQueryDataArtifact(queryDataArtifact{
				Version:         queryDataArtifactVersion,
				ResponseSummary: summarizeQueryDataResponse(resp),
				ResponseError:   truncateDiagnosticString(err.Error(), min(1024, maxBytes/4)),
				ResponseOmitted: true,
			}, request, maxBytes)
			if fallbackErr != nil {
				return nil, false, errors.Join(err, fallbackErr)
			}
			return out, false, err
		}
		artifact.Response = responseJSON
	}
	full, err := json.MarshalIndent(artifact, "", "  ")
	if err != nil || len(full) <= maxBytes {
		return full, false, err
	}

	out, err := fitQueryDataArtifact(queryDataArtifact{
		Version:         queryDataArtifactVersion,
		ResponseSummary: summarizeQueryDataResponse(resp),
		Truncated:       true,
		LimitBytes:      maxBytes,
		OriginalBytes:   len(full),
		ResponseOmitted: resp != nil,
	}, request, maxBytes)
	return out, true, err
}

// fitQueryDataArtifact encodes artifact with progressively less content -- request kept, request
// omitted, summary dropped, then markers only -- and returns the first encoding within maxBytes. The
// last rung holds only fixed-size markers, which keeps it under minQueryDataArtifactBytes so the
// budget gate in BuildDashboard stays meaningful; it is returned even when it somehow still doesn't
// fit, because there is nothing further to drop, and callers enforcing a hard budget re-check length.
func fitQueryDataArtifact(artifact queryDataArtifact, request json.RawMessage, maxBytes int) ([]byte, error) {
	artifact.Request = request
	out, err := json.MarshalIndent(artifact, "", "  ")
	if err != nil {
		return nil, err
	}
	if len(out) <= maxBytes {
		return out, nil
	}

	artifact.Request = nil
	artifact.RequestOmitted = len(request) > 0
	out, err = json.MarshalIndent(artifact, "", "  ")
	if err != nil {
		return nil, err
	}
	if len(out) <= maxBytes {
		return out, nil
	}

	artifact.ResponseSummary = nil
	out, err = json.MarshalIndent(artifact, "", "  ")
	if err != nil {
		return nil, err
	}
	if len(out) <= maxBytes {
		return out, nil
	}

	// ResponseError goes last: it is the only remaining field without a fixed size, and the same failure
	// is recorded outside the artifact, so dropping it leaves markers a reader can still act on.
	artifact.ResponseError = ""
	return json.MarshalIndent(artifact, "", "  ")
}

func summarizeQueryDataResponse(resp *backend.QueryDataResponse) map[string]queryDataResponseSummary {
	if resp == nil {
		return nil
	}
	summaries := make(map[string]queryDataResponseSummary, len(resp.Responses))
	for refID, response := range resp.Responses {
		if isHARResponse(refID) {
			continue
		}
		status := response.Status
		if !status.IsValid() {
			// Core datasources run in-process, so nothing normalizes their status the way the SDK does on
			// the gRPC boundary, and several return a bare DataResponse{Error: ...} with status unset.
			// Assume OK only when the response carries no error, otherwise the summary reports success
			// next to an error string.
			status = backend.StatusOK
			if response.Error != nil {
				status = backend.StatusUnknown
			}
		}
		summary := queryDataResponseSummary{
			RefID:       refID,
			Status:      status,
			ErrorSource: response.ErrorSource,
		}
		if response.Error != nil {
			summary.Error = truncateDiagnosticString(response.Error.Error(), 1024)
		}
		for _, frame := range response.Frames {
			if frame == nil {
				continue
			}
			rows, err := frame.RowLen()
			if err != nil {
				rows = -1
			}
			summary.Frames = append(summary.Frames, queryDataFrameSummary{
				Name:   truncateDiagnosticString(frame.Name, 256),
				RefID:  truncateDiagnosticString(frame.RefID, 256),
				Rows:   rows,
				Fields: len(frame.Fields),
			})
		}
		summaries[refID] = summary
	}
	return summaries
}

func truncateDiagnosticString(value string, maxBytes int) string {
	if len(value) <= maxBytes {
		return value
	}
	// Back off to a rune boundary so a multi-byte name/refId/error isn't cut mid-rune and land in the
	// summary with a mangled final character once JSON-encoded.
	end := maxBytes
	for end > 0 && !utf8.RuneStart(value[end]) {
		end--
	}
	return value[:end] + "…"
}

// DashboardPanel is one panel's captured input for a whole-dashboard diagnostics archive. The
// caller runs each panel's queries with an independent HAR capture buffer and hands the results
// here for assembly.
type DashboardPanel struct {
	ID           int64
	Title        string
	PanelJSON    json.RawMessage
	QueryRequest json.RawMessage // MetricRequest submitted for this panel
	// QueryRequestErr records a failure to serialize this panel's MetricRequest. Kept separate so one
	// unserializable request only costs this panel its request JSON, not the whole multi-panel bundle.
	QueryRequestErr error
	Datasources     []string                   // datasource UIDs the panel references (for the manifest)
	Resp            *backend.QueryDataResponse // query response, carries external plugins' __har__ frames
	HARBuffer       *harcapture.Buffer         // in-process capture buffer for this panel's queries
	QueryErr        error                      // top-level error running the panel's queries, if any
	Skipped         string                     // non-empty => panel was not executed (e.g. non-data panel)
}

// dashboardManifest is manifest.json: a machine-readable summary of what the whole-dashboard bundle
// contains, so a reader can see which panels ran, were skipped, or errored without unpacking each dir.
type dashboardManifest struct {
	GeneratedAt string               `json:"generatedAt"`
	PanelsTotal int                  `json:"panelsTotal"`
	PanelsRun   int                  `json:"panelsRun"`
	Panels      []manifestPanelEntry `json:"panels"`
}

type manifestPanelEntry struct {
	ID                 int64    `json:"id"`
	Title              string   `json:"title"`
	Dir                string   `json:"dir,omitempty"`
	Datasources        []string `json:"datasources,omitempty"`
	HARBytes           int      `json:"harBytes,omitempty"`
	QueryDataBytes     int      `json:"queryDataBytes,omitempty"`
	QueryDataTruncated bool     `json:"queryDataTruncated,omitempty"`
	QueryDataError     string   `json:"queryDataError,omitempty"`
	// SnapshotBackendBytes/SnapshotBackendError are scoped to snapshot-backend.json rather than named
	// "snapshot" generically: the rendered (post-transform) counterpart lands as snapshot-rendered.json
	// and needs its own pair, and renaming these later would break readers of an artifact schema.
	SnapshotBackendBytes int    `json:"snapshotBackendBytes,omitempty"`
	SnapshotBackendError string `json:"snapshotBackendError,omitempty"`
	Skipped              string `json:"skipped,omitempty"`
	Error                string `json:"error,omitempty"`
	// CaptureError records a failure to serialize this panel's captured traffic. It's kept separate
	// from Error (a query failure) so one unserializable buffer only loses this panel's traffic.har,
	// not the whole multi-panel bundle.
	CaptureError string `json:"captureError,omitempty"`
}

// snapshotArtifactTitle names both the snapshot dashboard and its panel when the panel model doesn't
// supply a title of its own.
const snapshotArtifactTitle = "Diagnostics snapshot (backend / plugin output)"

// marshalSnapshotBackendArtifact builds an importable, data-baked dashboard from the backend
// QueryDataResponse. It reuses Grafana's snapshot format -- a Grafana-datasource target with
// queryType "snapshot" carrying the response frames verbatim (the same DataFrameJSON querydata.json
// records) -- so the dashboard renders OFFLINE, with no live datasource and no query re-run: the
// "what did the plugin return" view a support engineer can open and see. panelJSON, when present,
// supplies the panel's visualization + field config so the render matches the real panel; its own
// datasource/targets are replaced so the imported panel can never re-query.
//
// This is the EXPLORABLE copy of the pipeline: the frames are frozen at the plugin's output, but the
// panel's transformations ride along so a reader can re-run and tweak them against real data (see
// snapshotPanel). Its frozen counterpart, snapshot-rendered.json, bakes post-transform frames with the
// transforms stripped -- what the user actually saw -- and a divergence between the two is a finding
// in its own right.
//
// queryRequestJSON supplies the submitted time range, which is baked into the dashboard: an import
// with no time range defaults to now-6h, so a bundle read a day later would render an empty panel
// with the frames sitting outside the window.
//
// Returns nil (no artifact) when there is no response or no frames to bake.
func marshalSnapshotBackendArtifact(panelJSON, queryRequestJSON json.RawMessage, resp *backend.QueryDataResponse) ([]byte, error) {
	if resp == nil {
		return nil, nil
	}
	frames, err := snapshotFrames(resp)
	if err != nil || len(frames) == 0 {
		return nil, err
	}

	panel := snapshotPanel(panelJSON)
	// One target holding every refID's frames, matching the format's only other producer (the scenes
	// snapshot serializer). Per-refID targets look tidier but lose data: the Grafana datasource emits
	// each snapshot target as a keyless response packet, and the query runner then keys packets by the
	// first frame's refId -- which is omitempty in the SDK and unset by core datasources such as
	// Prometheus -- so sibling targets collapse onto the same key and all but one are dropped.
	panel["targets"] = []map[string]any{{
		"refId":      "A",
		"datasource": grafanaSnapshotDatasourceRef(),
		"queryType":  "snapshot",
		"snapshot":   frames,
	}}

	dashboard := map[string]any{
		"schemaVersion": schemaversion.LATEST_VERSION,
		"title":         snapshotArtifactTitle,
		"editable":      true,
		"panels":        []any{panel},
	}
	if timeRange := snapshotTimeRange(queryRequestJSON); timeRange != nil {
		dashboard["time"] = timeRange
	}
	return json.MarshalIndent(dashboard, "", "  ")
}

// snapshotFrames encodes every non-capture frame in resp as DataFrameJSON, in deterministic refID
// order so the artifact (and its tests) are stable. Frames are encoded one at a time rather than by
// re-marshalling the whole response: the response JSON has already been built once for
// querydata.json, and a second full encode plus a decode into frames would hold several copies of a
// large response at peak.
func snapshotFrames(resp *backend.QueryDataResponse) ([]json.RawMessage, error) {
	refIDs := make([]string, 0, len(resp.Responses))
	for refID := range resp.Responses {
		if !isHARResponse(refID) {
			refIDs = append(refIDs, refID)
		}
	}
	sort.Strings(refIDs)

	var frames []json.RawMessage
	for _, refID := range refIDs {
		for _, frame := range resp.Responses[refID].Frames {
			if frame == nil {
				continue
			}
			// Merging every refID into one target loses the per-refID grouping the response map gave us,
			// so stamp the refId the frame is missing -- the snapshot format expects the payload itself to
			// reference the original refIds. Stamped on a copy: resp belongs to the caller, which also
			// serializes it for querydata.json.
			stamped := *frame
			if stamped.RefID == "" {
				stamped.RefID = refID
			}
			encoded, err := data.FrameToJSON(&stamped, data.IncludeAll)
			if err != nil {
				return nil, fmt.Errorf("encode frame for refId %s: %w", refID, err)
			}
			frames = append(frames, encoded)
		}
	}
	return frames, nil
}

// hasSnapshotFrames reports whether resp holds at least one frame the snapshot could bake, without
// encoding anything. A non-nil response is not the same as one with frames -- a panel whose queries
// all failed carries per-refID errors and no frames, which is the common case in a diagnostics bundle
// -- so BuildDashboard needs this to tell "nothing to bake" (not a failure, exactly as the
// single-panel path treats it) from "the snapshot didn't fit" BEFORE its budget gate decides which of
// the two to record.
func hasSnapshotFrames(resp *backend.QueryDataResponse) bool {
	if resp == nil {
		return false
	}
	for refID, response := range resp.Responses {
		if isHARResponse(refID) {
			continue
		}
		for _, frame := range response.Frames {
			if frame != nil {
				return true
			}
		}
	}
	return false
}

// snapshotPanel builds the snapshot dashboard's single panel from the supplied panel model, keeping
// only what a v1 dashboard can render offline. Callers set the targets.
func snapshotPanel(panelJSON json.RawMessage) map[string]any {
	panel := map[string]any{}
	if len(panelJSON) > 0 {
		// v2 dashboards store elements as {kind, spec}, and BuildDashboard hands that through verbatim
		// (see indexPanelJSON), so the wrapper has to be translated rather than unmarshalled as a panel.
		// A malformed panel model shouldn't lose the snapshot either; both fall back to a minimal panel.
		if spec := v2ElementSpec(panelJSON); spec != nil {
			panel = v1PanelFromV2Spec(spec)
		} else if err := json.Unmarshal(panelJSON, &panel); err != nil {
			panel = map[string]any{}
		}
	}
	if _, ok := panel["type"]; !ok {
		panel["type"] = "timeseries"
	}
	if _, ok := panel["title"]; !ok {
		panel["title"] = snapshotArtifactTitle
	}
	panel["id"] = 1
	panel["gridPos"] = map[string]any{"h": 12, "w": 24, "x": 0, "y": 0}
	panel["datasource"] = grafanaSnapshotDatasourceRef()
	delete(panel, "snapshotData")
	// A library-panel reference would make the import resolve the panel from a library uid that doesn't
	// exist in the reader's Grafana, discarding the baked targets along with the panel model.
	delete(panel, "libraryPanel")
	// Transformations are deliberately KEPT. This is the explorable copy of the pipeline: the frames are
	// the plugin's output and the panel's transform config sits on top, so a reader can import it, toggle
	// or edit a transform, and watch the result move -- the dashboard is editable, so stripping them
	// would be the lossy, irreversible choice (they cannot be added back from the artifact alone,
	// whereas removing them in the imported panel is two clicks).
	//
	// The frozen "what the user saw" view is snapshot-rendered.json's job: it bakes post-transform
	// frames with the transforms stripped. That split is what makes a divergence between the two
	// meaningful -- transform replay here vs. what the customer's browser actually produced -- and
	// stripping transforms here would destroy the signal instead, since the two would then differ
	// whenever the panel has any transform at all.
	//
	// Safe alongside the single-target merge below: frames carry the refId they came from (stamped in
	// snapshotFrames), so refId-addressed transforms such as filterByRefId and seriesToColumns still
	// resolve.
	// The baked dashboard time range is the range the queries actually ran over, and the client reads
	// it from the PANEL's effective range -- so a relative override has already been resolved into the
	// absolute timestamps baked below. Leaving the override on the panel applies it a SECOND time: a
	// timeShift shifts the absolute range further off the frames and the panel renders empty. Dropped
	// rather than reconciled, since the override's whole purpose (a window relative to now) is
	// meaningless once the data is frozen. The v2 path already drops these -- v2 keeps them in
	// data.spec.queryOptions, which v1PanelFromV2Spec doesn't carry over.
	delete(panel, "timeFrom")
	delete(panel, "timeShift")
	delete(panel, "timeCompare")
	delete(panel, "hideTimeOverride")
	// Repeat is meaningless here for the same reason: the snapshot dashboard carries no templating, and
	// one panel's frames are all there is to render. It does not merely no-op -- the repeat processor
	// substitutes an empty variable for the missing one and binds the panel's clone to the value ""
	// (see DashboardGridItem.performRepeat), so "$host" in a title or description renders BLANK instead
	// of showing which series was captured. Kept out so the panel reads as what it is: the one panel
	// whose queries ran. A repeated panel is the common case here -- the client resolves a clone's save
	// model back to the source panel, which is the one carrying these fields.
	delete(panel, "repeat")
	delete(panel, "repeatDirection")
	delete(panel, "maxPerRow")
	return panel
}

// v2ElementSpec returns the spec of a v2 dashboard element ({kind, spec}), or nil if raw isn't one.
func v2ElementSpec(raw json.RawMessage) json.RawMessage {
	var element struct {
		Kind string          `json:"kind"`
		Spec json.RawMessage `json:"spec"`
	}
	if err := json.Unmarshal(raw, &element); err != nil || element.Kind == "" || len(element.Spec) == 0 {
		return nil
	}
	return element.Spec
}

// v1PanelFromV2Spec translates the parts of a v2 panel spec that a v1 snapshot dashboard can render:
// the viz plugin and its options/fieldConfig, the panel's transformations, and its identity. Queries
// are dropped because the snapshot replaces them; the spec is translated field by field rather than
// copied wholesale, which would emit a hybrid v1/v2 object and carry the original datasource refs into
// an artifact that must not re-query.
//
// Transformations come across so the v2 path is as explorable as the v1 one -- a snapshot that kept the
// pipeline for v1 dashboards and silently dropped it for v2 would make the artifact mean different
// things depending on the source dashboard's version. Only the v2 WRAPPER differs: a v2
// TransformationKind is {kind, spec} where kind repeats the transformation id and spec is already a
// complete v1 DataTransformerConfig ({id, options, disabled, filter, topic}), so lifting each spec is
// the whole translation.
//
// A v2 LibraryPanel element reaches here too (indexPanelJSON indexes both kinds), and its spec is only
// {id, title, libraryPanel} -- the viz lives in the library, not the dashboard. The whitelist is what
// keeps the library ref out of the artifact, so nothing can resolve the panel from a uid the reader's
// Grafana doesn't have; the cost is no "type", and snapshotPanel's fallback renders the frames as a
// timeseries. The same trade the v1 path makes by deleting libraryPanel: a generic render of the real
// data beats no snapshot at all.
func v1PanelFromV2Spec(spec json.RawMessage) map[string]any {
	var v2 struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Transparent bool   `json:"transparent"`
		Data        struct {
			Spec struct {
				Transformations []struct {
					Spec json.RawMessage `json:"spec"`
				} `json:"transformations"`
			} `json:"spec"`
		} `json:"data"`
		VizConfig struct {
			Kind    string `json:"kind"`
			Group   string `json:"group"`
			Version string `json:"version"`
			Spec    struct {
				Options     map[string]any  `json:"options"`
				FieldConfig json.RawMessage `json:"fieldConfig"`
			} `json:"spec"`
		} `json:"vizConfig"`
	}
	if err := json.Unmarshal(spec, &v2); err != nil {
		return map[string]any{}
	}

	panel := map[string]any{}
	// v2alpha1 put the plugin id in vizConfig.kind; v2beta1 onwards moved it to vizConfig.group and set
	// kind to the literal "VizConfig".
	pluginID := v2.VizConfig.Group
	if pluginID == "" && v2.VizConfig.Kind != "VizConfig" {
		pluginID = v2.VizConfig.Kind
	}
	if pluginID != "" {
		panel["type"] = pluginID
	}
	if v2.Title != "" {
		panel["title"] = v2.Title
	}
	if v2.Description != "" {
		panel["description"] = v2.Description
	}
	if v2.Transparent {
		panel["transparent"] = true
	}
	if v2.VizConfig.Version != "" {
		panel["pluginVersion"] = v2.VizConfig.Version
	}
	if len(v2.VizConfig.Spec.Options) > 0 {
		panel["options"] = v2.VizConfig.Spec.Options
	}
	if len(v2.VizConfig.Spec.FieldConfig) > 0 {
		panel["fieldConfig"] = v2.VizConfig.Spec.FieldConfig
	}
	// Each entry's spec is already a v1 DataTransformerConfig, so it is carried verbatim; the {kind,
	// spec} wrapper around it is what stays behind.
	var transformations []json.RawMessage
	for _, t := range v2.Data.Spec.Transformations {
		if len(t.Spec) > 0 {
			transformations = append(transformations, t.Spec)
		}
	}
	if len(transformations) > 0 {
		panel["transformations"] = transformations
	}
	return panel
}

// snapshotTimeRange resolves the submitted MetricRequest's time range for the snapshot dashboard.
// The client sends epoch milliseconds, which are converted to absolute RFC3339 because a dashboard's
// time.from/to is parsed as a date expression, not a number; anything else (a relative "now-1h" from
// a non-browser caller) is passed through verbatim. Returns nil when there is no range to bake, so
// the import falls back to Grafana's default.
//
// Only the request's TOP-LEVEL range is read. Under Query V2 (the X-Query-V2 header, which makes both
// handlers dispatch to QueryDataNew) an individual query's own "timeRange" overrides that global range
// for the query that actually ran -- see getTimeRange in pkg/services/query -- so a panel mixing
// per-query ranges would bake a window its frames may sit outside of. Left as-is deliberately: no
// client sends that header today, and collapsing several per-query windows into the one range a
// dashboard can hold (widest span? first query's?) is a decision worth making against a real caller
// rather than guessed at here.
func snapshotTimeRange(queryRequestJSON json.RawMessage) map[string]any {
	if len(queryRequestJSON) == 0 {
		return nil
	}
	var request struct {
		From string `json:"from"`
		To   string `json:"to"`
	}
	if err := json.Unmarshal(queryRequestJSON, &request); err != nil {
		return nil
	}
	if request.From == "" || request.To == "" {
		return nil
	}
	return map[string]any{
		"from": snapshotTimeValue(request.From),
		"to":   snapshotTimeValue(request.To),
	}
}

func snapshotTimeValue(value string) string {
	if epochMillis, err := strconv.ParseInt(value, 10, 64); err == nil {
		return time.UnixMilli(epochMillis).UTC().Format(time.RFC3339Nano)
	}
	return value
}

// BuildDashboard assembles a whole-dashboard .tar.gz: a shared dashboard.json and manifest.json plus
// per-panel panels/<id>-<slug>/{panel.json, querydata.json, traffic.har, query-error.txt}.
//
// Like Build, captured traffic and error text are recorded VERBATIM -- redaction is intentionally
// deferred (see the harcapture package doc) -- and server logs are omitted (not request-scoped).
func (b *Bundler) BuildDashboard(dashboardJSON json.RawMessage, panels []DashboardPanel) ([]byte, error) {
	manifest := dashboardManifest{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		PanelsTotal: len(panels),
	}

	files := map[string][]byte{}
	if len(dashboardJSON) > 0 {
		files["dashboard.json"] = indentJSON(dashboardJSON)
	}

	usedDirs := map[string]bool{}
	queryDataBytesRemaining := maxDashboardQueryDataBytes
	panelJSONByID := indexPanelJSON(dashboardJSON)
	for _, p := range panels {
		entry := manifestPanelEntry{ID: p.ID, Title: p.Title, Datasources: p.Datasources}

		if p.Skipped != "" {
			entry.Skipped = p.Skipped
			manifest.Panels = append(manifest.Panels, entry)
			continue
		}

		dir := uniquePanelDir(p.ID, p.Title, usedDirs)
		entry.Dir = dir
		// The whole-dashboard client posts the dashboard save model once rather than each panel's JSON
		// separately, so resolve this panel's JSON from that model by id when it wasn't supplied inline.
		panelJSON := p.PanelJSON
		if len(panelJSON) == 0 {
			panelJSON = panelJSONByID[p.ID]
		}
		if len(panelJSON) > 0 {
			files[dir+"/panel.json"] = indentJSON(panelJSON)
		}
		// A panel can hit more than one query-data problem: an unserializable request still leaves a
		// response to encode, which can itself fail or exhaust the dashboard budget. Collect them all so
		// a later failure doesn't hide the request-serialize failure that explains the missing request --
		// the single-panel Build path joins the same combination into querydata-error.txt.
		var queryDataErrs []string
		if p.QueryRequestErr != nil {
			queryDataErrs = append(queryDataErrs, "serialize query request: "+p.QueryRequestErr.Error())
		}
		if p.Resp != nil || len(p.QueryRequest) > 0 {
			queryDataLimit := min(maxQueryDataArtifactBytes, queryDataBytesRemaining)
			if queryDataLimit < minQueryDataArtifactBytes {
				entry.QueryDataTruncated = true
				queryDataErrs = append(queryDataErrs, fmt.Sprintf("remaining dashboard query-data budget (%d bytes) below the %d-byte minimum artifact size", queryDataBytesRemaining, minQueryDataArtifactBytes))
			} else {
				queryData, truncated, err := marshalQueryDataArtifactWithLimit(p.QueryRequest, p.Resp, queryDataLimit)
				if err != nil {
					queryDataErrs = append(queryDataErrs, err.Error())
				}
				// An unencodable response still leaves a degraded artifact (request plus frame summary),
				// so write whatever survived instead of discarding it along with the error.
				switch {
				case len(queryData) == 0:
					// Nothing survived the failure; the error above is the whole record.
				case len(queryData) > queryDataLimit:
					entry.QueryDataTruncated = true
					queryDataErrs = append(queryDataErrs, "query-data artifact exceeded its assigned dashboard budget")
				default:
					files[dir+"/querydata.json"] = queryData
					entry.QueryDataBytes = len(queryData)
					queryDataBytesRemaining -= len(queryData)
					entry.QueryDataTruncated = truncated
				}
			}
		}
		// Joined with "; " rather than errors.Join's newline so the manifest keeps one readable line per
		// panel instead of embedded \n escapes.
		entry.QueryDataError = strings.Join(queryDataErrs, "; ")

		// snapshot-backend.json: importable, data-baked view of this panel's returned frames (renders
		// offline). Convenience artifact -- querydata.json remains the authoritative record -- so it draws
		// from what querydata.json left of the shared dashboard budget rather than getting a pool of its
		// own, and is omitted (with the reason in the manifest) on failure or when the budget is spent.
		// Gated on having FRAMES, not merely a response: a panel whose queries all failed carries
		// per-refID errors and nothing to bake, and that is not a failure of the snapshot (the
		// single-panel path treats it the same way). Checking first keeps the budget gate below from
		// reporting such a panel's absent snapshot as dropped-for-budget.
		if hasSnapshotFrames(p.Resp) {
			snapshotLimit := min(maxQueryDataArtifactBytes, queryDataBytesRemaining)
			if snapshotLimit < minQueryDataArtifactBytes {
				// Checked BEFORE marshalling, mirroring the query-data gate above: the snapshot is
				// all-or-nothing (there is no truncated form to fall back to), so building one for every
				// remaining panel just to measure and discard it would re-encode the whole response -- the
				// largest allocation in this path -- once per panel with no budget left to spend on it.
				entry.SnapshotBackendError = fmt.Sprintf("remaining dashboard query-data budget (%d bytes) below the %d-byte minimum artifact size", queryDataBytesRemaining, minQueryDataArtifactBytes)
			} else if snapshot, err := marshalSnapshotBackendArtifact(panelJSON, p.QueryRequest, p.Resp); err != nil {
				entry.SnapshotBackendError = err.Error()
			} else if len(snapshot) > 0 {
				if len(snapshot) <= snapshotLimit {
					files[dir+"/snapshot-backend.json"] = snapshot
					entry.SnapshotBackendBytes = len(snapshot)
					queryDataBytesRemaining -= len(snapshot)
				} else {
					entry.SnapshotBackendError = fmt.Sprintf("snapshot-backend artifact (%d bytes) exceeded the remaining dashboard query-data budget (%d bytes)", len(snapshot), snapshotLimit)
				}
			}
		}

		// A single panel's capture that fails to serialize must not sink the whole multi-panel bundle:
		// record it against this panel in the manifest and keep everything else (dashboard.json, the
		// other panels' traffic, manifest). Only this panel loses its traffic.har.
		har, err := collectHAR(p.Resp, p.HARBuffer)
		if err != nil {
			entry.CaptureError = err.Error()
		} else if len(har) > 0 {
			files[dir+"/traffic.har"] = har
			entry.HARBytes = len(har)
		}

		if p.QueryErr != nil {
			entry.Error = p.QueryErr.Error()
			files[dir+"/query-error.txt"] = []byte(p.QueryErr.Error() + "\n")
		} else {
			manifest.PanelsRun++
		}

		manifest.Panels = append(manifest.Panels, entry)
	}

	if manifestJSON, err := json.MarshalIndent(manifest, "", "  "); err == nil {
		files["manifest.json"] = manifestJSON
	}

	return buildTarGz(files)
}

// indexPanelJSON indexes the raw panel JSON from v1 and v2 dashboard save models by panel id.
// Each entry is stored as it appears in its own schema, so panel.json shape differs by version:
// the bare panel object for v1 (from "panels"), and the full {kind, spec} element for v2 (from
// "elements") -- the same split the bundle's dashboard.json already has.
// Collapsed v1 rows carry their children in a nested "panels" array, so the index includes them recursively.
func indexPanelJSON(dashboardJSON json.RawMessage) map[int64]json.RawMessage {
	panelsByID := make(map[int64]json.RawMessage)
	if len(dashboardJSON) == 0 {
		return panelsByID
	}
	var doc struct {
		Panels   []json.RawMessage          `json:"panels"`
		Elements map[string]json.RawMessage `json:"elements"`
	}
	if err := json.Unmarshal(dashboardJSON, &doc); err != nil {
		return panelsByID
	}
	indexPanelsByID(doc.Panels, panelsByID)
	indexElementsByID(doc.Elements, panelsByID)
	return panelsByID
}

func indexPanelsByID(panels []json.RawMessage, panelsByID map[int64]json.RawMessage) {
	for _, raw := range panels {
		var meta struct {
			ID     *int64            `json:"id"`
			Panels []json.RawMessage `json:"panels"`
		}
		if err := json.Unmarshal(raw, &meta); err != nil {
			continue
		}
		if meta.ID != nil {
			if _, exists := panelsByID[*meta.ID]; !exists {
				panelsByID[*meta.ID] = raw
			}
		}
		indexPanelsByID(meta.Panels, panelsByID)
	}
}

// indexElementsByID indexes v2 "elements" entries by their spec.id. Both a regular "Panel" and a
// "LibraryPanel" carry a spec with a panel id, so both are indexed; other element kinds (rows, tabs,
// ...) have no panel id and are skipped. Only "Panel" carries the panel's viz config, though -- a
// LibraryPanel spec is just {id, title, libraryPanel} and the model lives in the library -- so a
// reader of panel.json (and anything deriving from it, e.g. v1PanelFromV2Spec) gets identity only.
func indexElementsByID(elements map[string]json.RawMessage, panelsByID map[int64]json.RawMessage) {
	for _, raw := range elements {
		var meta struct {
			Kind string `json:"kind"`
			Spec struct {
				ID *int64 `json:"id"`
			} `json:"spec"`
		}
		if err := json.Unmarshal(raw, &meta); err != nil || (meta.Kind != "Panel" && meta.Kind != "LibraryPanel") || meta.Spec.ID == nil {
			continue
		}
		if _, exists := panelsByID[*meta.Spec.ID]; !exists {
			panelsByID[*meta.Spec.ID] = raw
		}
	}
}

// uniquePanelDir builds a stable, filesystem-safe directory name (panels/<id>-<slug>),
// disambiguating collisions with a numeric suffix.
func uniquePanelDir(id int64, title string, used map[string]bool) string {
	base := fmt.Sprintf("panels/%d", id)
	if slug := panelTitleSlug(title); slug != "" {
		base += "-" + slug
	}
	dir := base
	for i := 2; used[dir]; i++ {
		dir = fmt.Sprintf("%s-%d", base, i)
	}
	used[dir] = true
	return dir
}

// panelTitleSlug lowercases a title and keeps only [a-z0-9], collapsing other runs to single
// hyphens and capping length so directory names stay short and portable.
func panelTitleSlug(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash && b.Len() > 0 {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 40 {
		out = strings.Trim(out[:40], "-")
	}
	return out
}

// harResponseRefIDPrefix is the reserved refId prefix for the synthetic capture responses that
// externalized (gRPC) plugins return. The SDK namespaces the refId per datasource UID (e.g.
// "__har__P123") so frames from multiple datasources don't collide when Grafana merges a
// multi-datasource query into one flat response map (pkg/services/query); older/no-UID plugins use
// the bare prefix. We therefore match these responses by PREFIX, not an exact key.
const harResponseRefIDPrefix = "__har__"

// isHARResponse reports whether a refId is a synthetic capture response (matched by prefix).
func isHARResponse(refID string) bool {
	return strings.HasPrefix(refID, harResponseRefIDPrefix)
}

func queryDataResponseWithoutCaptureFrames(resp *backend.QueryDataResponse) *backend.QueryDataResponse {
	filtered := backend.NewQueryDataResponse()
	if resp == nil {
		return filtered
	}
	for refID, dataResponse := range resp.Responses {
		if !isHARResponse(refID) {
			filtered.Responses[refID] = dataResponse
		}
	}
	return filtered
}

// forEachHARFrameCustom calls fn with the Custom map of every frame across all synthetic capture
// responses (__har__-prefixed) in resp. No-op when resp is nil. Centralizes the nil-checks and type
// assertion so collectHAR / HasCapturedHAR / PluginCaptureError don't each re-implement them.
func forEachHARFrameCustom(resp *backend.QueryDataResponse, fn func(custom map[string]interface{})) {
	if resp == nil {
		return
	}
	for refID, r := range resp.Responses {
		if !isHARResponse(refID) {
			continue
		}
		for _, frame := range r.Frames {
			if frame == nil || frame.Meta == nil {
				continue
			}
			if custom, ok := frame.Meta.Custom.(map[string]interface{}); ok {
				fn(custom)
			}
		}
	}
}

// ResponseError returns a combined error describing any per-refId query failures in resp
// (backend.DataResponse.Error), or nil if there are none. Datasource queries usually fail this way
// — QueryData returns no top-level error while individual responses carry the failure — so a caller
// that only checks the top-level error would miss them. Errors are wrapped per refId (preserving
// errors.Is/As for typed classification) and ordered deterministically by refId.
func ResponseError(resp *backend.QueryDataResponse) error {
	if resp == nil {
		return nil
	}
	refIDs := make([]string, 0, len(resp.Responses))
	for refID, r := range resp.Responses {
		// Skip the synthetic capture frames: an externalized plugin sets an error on them (so the
		// SDK's own middlewares see the failure), but their clean error text is read via
		// PluginCaptureError, not surfaced here under the reserved refIDs.
		if isHARResponse(refID) {
			continue
		}
		if r.Error != nil {
			refIDs = append(refIDs, refID)
		}
	}
	if len(refIDs) == 0 {
		return nil
	}
	sort.Strings(refIDs)
	errs := make([]error, 0, len(refIDs))
	for _, refID := range refIDs {
		errs = append(errs, fmt.Errorf("%s: %w", refID, resp.Responses[refID].Error))
	}
	return errors.Join(errs...)
}

// PluginCaptureError returns the error an externalized (gRPC) plugin stashed alongside its captured
// __har__ frame (Custom["queryError"]), or nil if absent. The SDK capture middleware records a
// top-level QueryData error there rather than returning it, because a gRPC error would discard the
// whole response — and the captured traffic with it — before it crossed the wire. Reading it back
// here lets the failure still be recorded in the bundle.
func PluginCaptureError(resp *backend.QueryDataResponse) error {
	var msgs []string
	forEachHARFrameCustom(resp, func(custom map[string]interface{}) {
		if msg, ok := custom["queryError"].(string); ok && msg != "" {
			msgs = append(msgs, msg)
		}
	})
	if len(msgs) == 0 {
		return nil
	}
	// A multi-datasource run can have more than one external plugin stash an error; report them all,
	// ordered for determinism.
	sort.Strings(msgs)
	return errors.New(strings.Join(msgs, "\n"))
}

// HasCapturedHAR reports whether any HAR traffic was captured for this request — either the
// in-process buffer has entries (core plugins) or an external plugin returned a __har__ frame. The
// handler uses it to decide whether a failed query still has something worth bundling.
func HasCapturedHAR(resp *backend.QueryDataResponse, harBuffer *harcapture.Buffer) bool {
	if harBuffer != nil && harBuffer.Len() > 0 {
		return true
	}
	// A frame only counts if its "har" payload actually parses as HAR JSON -- entries may
	// legitimately be empty (the plugin's capture middleware ran but made zero HTTP calls), but a
	// malformed payload is indistinguishable from no payload at all: collectHAR/mergeHAR would skip
	// it and contribute nothing to the bundle, so treating it as "captured" here would wrongly
	// suppress the no-capture error path and leave the handler returning a 200 bundle with no
	// traffic.har.
	captured := false
	forEachHARFrameCustom(resp, func(custom map[string]interface{}) {
		if harStr, ok := custom["har"].(string); ok && isParseableHAR(harStr) {
			captured = true
		}
	})
	return captured
}

// collectHAR returns the captured HTTP traffic as HAR 1.2 JSON. It merges two sources: the
// in-process buffer (core plugins) and the __har__ response frame(s) returned by externalized gRPC
// plugins. Returns (nil, nil) when nothing was captured, and a non-nil error if traffic was
// captured but could not be serialized (so the caller can fail rather than return an empty bundle).
//
// NOTE: the __har__ frame path is inert until the SDK-side HTTP capture middleware that emits those
// frames ships and Grafana is bumped to that SDK version — until then external (out-of-process)
// plugin traffic is NOT captured. Externally-sourced frames are merged VERBATIM: redaction is
// intentionally deferred (see the harcapture package doc), so — exactly like in-process capture —
// the recorded headers/cookies/query/URLs/bodies are not sanitized.
func collectHAR(resp *backend.QueryDataResponse, harBuffer *harcapture.Buffer) ([]byte, error) {
	var bufferDoc []byte
	if harBuffer != nil && harBuffer.Len() > 0 {
		b, err := harBuffer.ToHAR()
		if err != nil {
			// The in-process buffer captured traffic but couldn't be serialized. Surface the error
			// instead of silently dropping traffic.har and returning a success bundle with no
			// captured traffic.
			return nil, err
		}
		bufferDoc = b
	}

	// Synthetic __har__-prefixed responses carry capture from externalized gRPC plugins
	// (out-of-process). The SDK namespaces the refId per datasource (e.g. "__har__P123") so a
	// multi-datasource query yields one such response per external datasource; collect them all.
	// These are reserved synthetic refIds; consuming them here is harmless as query results are not
	// part of the bundle (only captured traffic + panel/dashboard JSON).
	var frameDocs [][]byte
	if resp != nil {
		// Collect the reserved refIds first, then delete + drain them (can't delete while ranging the
		// map). Sorted so the merged HAR entry order is deterministic across datasources.
		var harRefIDs []string
		for refID := range resp.Responses {
			if isHARResponse(refID) {
				harRefIDs = append(harRefIDs, refID)
			}
		}
		sort.Strings(harRefIDs)
		for _, refID := range harRefIDs {
			harResp := resp.Responses[refID]
			delete(resp.Responses, refID)
			// A plugin may split its capture across multiple frames; collect every frame's HAR
			// payload rather than only the first, so no entries are lost.
			for _, frame := range harResp.Frames {
				if frame == nil || frame.Meta == nil {
					continue
				}
				custom, ok := frame.Meta.Custom.(map[string]interface{})
				if !ok {
					continue
				}
				if harStr, ok := custom["har"].(string); ok && harStr != "" {
					frameDocs = append(frameDocs, []byte(harStr))
				}
			}
		}
	}

	// Common case: only the in-process buffer captured traffic (core plugins). Its ToHAR output is
	// already a complete HAR 1.2 document, so return it directly rather than re-parsing and
	// re-marshaling every captured request/response through mergeHAR.
	if len(frameDocs) == 0 {
		return bufferDoc, nil
	}

	docs := frameDocs
	if bufferDoc != nil {
		docs = append([][]byte{bufferDoc}, frameDocs...)
	}
	return mergeHAR(docs)
}

// harEnvelope is the minimal HAR 1.2 shape used to inspect and merge captured documents.
type harEnvelope struct {
	Log struct {
		Creator json.RawMessage   `json:"creator"`
		Entries []json.RawMessage `json:"entries"`
	} `json:"log"`
}

// isParseableHAR reports whether harStr parses as HAR JSON. Shared by HasCapturedHAR and mergeHAR
// (via harEnvelope) so both agree on what a malformed payload is: HasCapturedHAR must not count a
// payload as captured if mergeHAR would just skip it and contribute nothing to the bundle. Entries
// may legitimately be empty -- that's a real, distinct "the plugin ran but made no calls" case, not
// a malformed one -- so this only checks parseability, not entry count.
func isParseableHAR(harStr string) bool {
	var env harEnvelope
	return json.Unmarshal([]byte(harStr), &env) == nil
}

// mergeHAR combines multiple HAR 1.2 documents into a single one by concatenating their
// log.entries. Documents that fail to parse are skipped. Returns (nil, nil) when there are no
// entries (a benign "no captured traffic" -- e.g. a valid but empty external frame), and a non-nil
// error only when the merged result can't be marshaled.
func mergeHAR(docs [][]byte) ([]byte, error) {
	entries := make([]json.RawMessage, 0)
	var creator json.RawMessage
	for _, d := range docs {
		var env harEnvelope
		if err := json.Unmarshal(d, &env); err != nil {
			continue
		}
		entries = append(entries, env.Log.Entries...)
		if creator == nil && len(env.Log.Creator) > 0 {
			creator = env.Log.Creator
		}
	}
	if len(entries) == 0 {
		// No usable entries: treat as "nothing captured", same as an empty in-process buffer, rather
		// than an error. (An untrusted plugin emitting an empty capture frame must not 500 the run.)
		return nil, nil
	}
	if creator == nil {
		creator = json.RawMessage(`{"name":"Grafana","version":"1.0"}`)
	}

	out := map[string]any{
		"log": map[string]any{
			"version": "1.2",
			"creator": creator,
			"entries": entries,
		},
	}
	return json.Marshal(out)
}

// buildTarGz packs the named files into a gzipped tar archive. Files are written in deterministic
// (sorted) name order.
func buildTarGz(files map[string][]byte) ([]byte, error) {
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	now := time.Now()
	for _, name := range names {
		data := files[name]
		hdr := &tar.Header{
			Name:    name,
			Mode:    0o600,
			Size:    int64(len(data)),
			ModTime: now,
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return nil, err
		}
		if _, err := tw.Write(data); err != nil {
			return nil, err
		}
	}

	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// indentJSON pretty-prints raw JSON for readability in the bundle, falling back to the raw bytes
// if it cannot be parsed.
func indentJSON(raw []byte) []byte {
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return raw
	}
	return out.Bytes()
}
