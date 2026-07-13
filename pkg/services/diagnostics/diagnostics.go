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
// TODO: re-add a request-scoped server log. The previous whole-file tail was dropped because it is
// not scoped to this request and would leak unrelated activity into a bundle meant for external
// sharing; log inclusion returns (behind a drawer option) once it can be scoped to the request.
// queryErr is the error (if any) from running the queries. A failed query is itself diagnostic
// signal — the captured HAR already holds the failed attempt(s) — so it is recorded in the bundle
// rather than causing the capture to be discarded.
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
		// Redact URL query params from the error text: a transport error (net/url.Error) embeds the
		// full request URL, and Go masks only userinfo passwords, so a credential in a query param
		// would otherwise leak into this externally-shared file despite the HAR-level redaction.
		files["query-error.txt"] = []byte(harcapture.RedactErrorText(queryErr.Error()) + "\n")
	}

	return buildTarGz(files)
}

// harResponseKey is the reserved synthetic refId under which externalized (gRPC) plugins return
// captured traffic as a __har__ response frame.
const harResponseKey = "__har__"

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
		// Skip the synthetic capture frame: an externalized plugin sets an error on it (so the SDK's
		// own middlewares see the failure), but its clean error text is read via PluginCaptureError,
		// not surfaced here under the reserved refID.
		if refID == harResponseKey {
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
	if resp == nil {
		return nil
	}
	r, ok := resp.Responses[harResponseKey]
	if !ok {
		return nil
	}
	for _, frame := range r.Frames {
		if frame == nil || frame.Meta == nil {
			continue
		}
		custom, ok := frame.Meta.Custom.(map[string]interface{})
		if !ok {
			continue
		}
		if msg, ok := custom["queryError"].(string); ok && msg != "" {
			return errors.New(msg)
		}
	}
	return nil
}

// HasCapturedHAR reports whether any HAR traffic was captured for this request — either the
// in-process buffer has entries (core plugins) or an external plugin returned a __har__ frame. The
// handler uses it to decide whether a failed query still has something worth bundling.
func HasCapturedHAR(resp *backend.QueryDataResponse, harBuffer *harcapture.Buffer) bool {
	if harBuffer != nil && harBuffer.Len() > 0 {
		return true
	}
	if resp != nil {
		if r, ok := resp.Responses[harResponseKey]; ok && len(r.Frames) > 0 {
			return true
		}
	}
	return false
}

// collectHAR returns the captured HTTP traffic as HAR 1.2 JSON. It merges two sources: the
// in-process buffer (core plugins) and the __har__ response frame(s) returned by externalized GRPC
// plugins. Returns (nil, nil) when nothing was captured, and a non-nil error if traffic was
// captured but could not be serialized (so the caller can fail rather than return an empty bundle).
//
// NOTE: the __har__ frame path is inert until the SDK-side HTTP capture middleware that emits those
// frames ships and Grafana is bumped to that SDK version (#1270) — until then external
// (out-of-process) plugin traffic is NOT captured. Externally-sourced frames are run through
// harcapture.RedactHARDocument before merging, so their headers/cookies/query/URLs are redacted the
// same way in-process capture is (don't rely on the plugin/SDK to redact).
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

	// __har__ frames carry capture from externalized gRPC plugins (out-of-process). "__har__" is a
	// reserved synthetic refId; a client query using it would be consumed here, but that's harmless
	// as query results are not part of the bundle (only captured traffic + panel/dashboard JSON).
	var frameDocs [][]byte
	if resp != nil {
		if harResp, ok := resp.Responses[harResponseKey]; ok {
			delete(resp.Responses, harResponseKey)
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
					// Redact externally-sourced entries just like in-process capture. A frame that
					// can't be redacted (nil) is dropped rather than merged unredacted.
					if redacted := harcapture.RedactHARDocument([]byte(harStr)); redacted != nil {
						frameDocs = append(frameDocs, redacted)
					}
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
	return mergeHAR(docs), nil
}

// mergeHAR combines multiple HAR 1.2 documents into a single one by concatenating their
// log.entries. Documents that fail to parse are skipped. Returns nil when there are no entries.
func mergeHAR(docs [][]byte) []byte {
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
		return nil
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
	b, err := json.Marshal(out)
	if err != nil {
		return nil
	}
	return b
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
