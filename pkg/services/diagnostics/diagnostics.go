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
	"strings"
	"time"
	"unicode/utf8"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

// Bundler assembles diagnostic bundles.
type Bundler struct{}

// Query responses can contain substantially more data than the diagnostic traffic itself. Keep
// their uncompressed JSON bounded independently so adding querydata.json cannot multiply a large
// panel/dashboard archive without an explicit truncation marker.
const (
	maxQueryDataArtifactBytes  = 8 << 20
	maxDashboardQueryDataBytes = 32 << 20
	// minQueryDataArtifactBytes is the smallest budget worth attempting: below it not even a truncated
	// artifact (version + omission markers) fits, so the panel's query data is skipped up front.
	minQueryDataArtifactBytes = 256
)

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
			// A response that cannot be JSON-encoded (e.g. non-finite floats) must not sink the whole
			// bundle: record the failure and still ship HAR and the other artifacts, mirroring how the
			// dashboard path degrades per panel via manifest.queryDataError.
			queryDataErr = errors.Join(queryDataErr, err)
		} else {
			files["querydata.json"] = queryData
		}
	}
	if queryDataErr != nil {
		files["querydata-error.txt"] = []byte(queryDataErr.Error() + "\n")
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
	Truncated       bool                                `json:"truncated,omitempty"`
	LimitBytes      int                                 `json:"limitBytes,omitempty"`
	OriginalBytes   int                                 `json:"originalBytes,omitempty"`
	RequestOmitted  bool                                `json:"requestOmitted,omitempty"`
	ResponseOmitted bool                                `json:"responseOmitted,omitempty"`
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
			return nil, false, err
		}
		artifact.Response = responseJSON
	}
	full, err := json.MarshalIndent(artifact, "", "  ")
	if err != nil || len(full) <= maxBytes {
		return full, false, err
	}

	truncated := queryDataArtifact{
		Version:         queryDataArtifactVersion,
		Request:         request,
		ResponseSummary: summarizeQueryDataResponse(resp),
		Truncated:       true,
		LimitBytes:      maxBytes,
		OriginalBytes:   len(full),
		ResponseOmitted: resp != nil,
	}
	out, err := json.MarshalIndent(truncated, "", "  ")
	if err != nil {
		return nil, true, err
	}
	if len(out) <= maxBytes {
		return out, true, nil
	}

	truncated.Request = nil
	truncated.RequestOmitted = len(request) > 0
	out, err = json.MarshalIndent(truncated, "", "  ")
	if err != nil {
		return nil, true, err
	}
	if len(out) <= maxBytes {
		return out, true, nil
	}

	out, err = json.MarshalIndent(queryDataArtifact{
		Version:         queryDataArtifactVersion,
		Truncated:       true,
		LimitBytes:      maxBytes,
		OriginalBytes:   len(full),
		RequestOmitted:  len(request) > 0,
		ResponseOmitted: resp != nil,
	}, "", "  ")
	return out, true, err
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
			status = backend.StatusOK
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
	Skipped            string   `json:"skipped,omitempty"`
	Error              string   `json:"error,omitempty"`
	// CaptureError records a failure to serialize this panel's captured traffic. It's kept separate
	// from Error (a query failure) so one unserializable buffer only loses this panel's traffic.har,
	// not the whole multi-panel bundle.
	CaptureError string `json:"captureError,omitempty"`
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
		if p.QueryRequestErr != nil {
			entry.QueryDataError = "serialize query request: " + p.QueryRequestErr.Error()
		}
		if p.Resp != nil || len(p.QueryRequest) > 0 {
			queryDataLimit := min(maxQueryDataArtifactBytes, queryDataBytesRemaining)
			if queryDataLimit < minQueryDataArtifactBytes {
				entry.QueryDataTruncated = true
				entry.QueryDataError = fmt.Sprintf("remaining dashboard query-data budget (%d bytes) below the %d-byte minimum artifact size", queryDataBytesRemaining, minQueryDataArtifactBytes)
			} else {
				queryData, truncated, err := marshalQueryDataArtifactWithLimit(p.QueryRequest, p.Resp, queryDataLimit)
				if err != nil {
					entry.QueryDataError = err.Error()
				} else if len(queryData) > queryDataLimit {
					entry.QueryDataTruncated = true
					entry.QueryDataError = "query-data artifact exceeded its assigned dashboard budget"
				} else {
					files[dir+"/querydata.json"] = queryData
					entry.QueryDataBytes = len(queryData)
					queryDataBytesRemaining -= len(queryData)
					entry.QueryDataTruncated = truncated
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
// "LibraryPanel" carry a resolved panel spec with an id, so both are indexed; other element kinds
// (rows, tabs, ...) have no panel id and are skipped.
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
