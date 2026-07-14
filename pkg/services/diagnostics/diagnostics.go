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
	// Only count a frame that actually carries a non-empty "har" payload -- the same thing collectHAR
	// extracts. A frame present but without a har payload contributes nothing, so treating it as
	// "captured" would wrongly suppress the no-capture error path.
	captured := false
	forEachHARFrameCustom(resp, func(custom map[string]interface{}) {
		if harStr, ok := custom["har"].(string); ok && harStr != "" {
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

// mergeHAR combines multiple HAR 1.2 documents into a single one by concatenating their
// log.entries. Documents that fail to parse are skipped. Returns (nil, nil) when there are no
// entries (a benign "no captured traffic" -- e.g. a valid but empty external frame), and a non-nil
// error only when the merged result can't be marshaled.
func mergeHAR(docs [][]byte) ([]byte, error) {
	type harEnvelope struct {
		Log struct {
			Creator json.RawMessage   `json:"creator"`
			Entries []json.RawMessage `json:"entries"`
		} `json:"log"`
	}

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
