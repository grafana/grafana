// Package diagnostics assembles on-demand datasource diagnostic bundles: captured HTTP traffic
// (HAR) and the panel/dashboard JSON. The HTTP handler in pkg/api runs the queries with capture
// active and delegates bundle assembly here.
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

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/httpclient/harcapture"
)

// Bundler assembles diagnostic bundles.
type Bundler struct{}

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
func (b *Bundler) Build(resp *backend.QueryDataResponse, harBuffer *harcapture.Buffer, panelJSON, dashboardJSON json.RawMessage, queryErr error) ([]byte, error) {
	files := map[string][]byte{}

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

// DashboardPanel is one panel's captured input for a whole-dashboard diagnostics archive. The
// caller runs each panel's queries with an independent HAR capture buffer and hands the results
// here for assembly.
type DashboardPanel struct {
	ID          int64
	Title       string
	PanelJSON   json.RawMessage
	Datasources []string                   // datasource UIDs the panel references (for the manifest)
	Resp        *backend.QueryDataResponse // query response, carries external plugins' __har__ frames
	HARBuffer   *harcapture.Buffer         // in-process capture buffer for this panel's queries
	QueryErr    error                      // top-level error running the panel's queries, if any
	Skipped     string                     // non-empty => panel was not executed (e.g. non-data panel)
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
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Dir         string   `json:"dir,omitempty"`
	Datasources []string `json:"datasources,omitempty"`
	HARBytes    int      `json:"harBytes,omitempty"`
	Skipped     string   `json:"skipped,omitempty"`
	Error       string   `json:"error,omitempty"`
	// CaptureError records a failure to serialize this panel's captured traffic. It's kept separate
	// from Error (a query failure) so one unserializable buffer only loses this panel's traffic.har,
	// not the whole multi-panel bundle.
	CaptureError string `json:"captureError,omitempty"`
}

// BuildDashboard assembles a whole-dashboard .tar.gz: a shared dashboard.json and manifest.json plus
// per-panel panels/<id>-<slug>/{panel.json, traffic.har, query-error.txt}.
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
	for _, p := range panels {
		entry := manifestPanelEntry{ID: p.ID, Title: p.Title, Datasources: p.Datasources}

		if p.Skipped != "" {
			entry.Skipped = p.Skipped
			manifest.Panels = append(manifest.Panels, entry)
			continue
		}

		dir := uniquePanelDir(p.ID, p.Title, usedDirs)
		entry.Dir = dir
		if len(p.PanelJSON) > 0 {
			files[dir+"/panel.json"] = indentJSON(p.PanelJSON)
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
