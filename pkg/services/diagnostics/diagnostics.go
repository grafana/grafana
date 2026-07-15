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
func (b *Bundler) Build(harBuffer *harcapture.Buffer, panelJSON, dashboardJSON json.RawMessage, queryErr error) ([]byte, error) {
	files := map[string][]byte{}

	har, err := collectHAR(harBuffer)
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
	Datasources []string           // datasource UIDs the panel references (for the manifest)
	HARBuffer   *harcapture.Buffer // capture buffer for this panel's queries
	QueryErr    error              // top-level error running the panel's queries, if any
	Skipped     string             // non-empty => panel was not executed (e.g. non-data panel)
}

// dashboardManifest is manifest.json: a machine-readable summary of what the whole-dashboard bundle
// contains, so a reader can see which panels ran, were skipped, or errored without unpacking each dir.
type dashboardManifest struct {
	GeneratedAt string               `json:"generatedAt"`
	PanelsTotal int                  `json:"panelsTotal"`
	PanelsRun   int                  `json:"panelsRun"`
	Truncated   bool                 `json:"truncated,omitempty"`
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
}

// BuildDashboard assembles a whole-dashboard .tar.gz: a shared dashboard.json and manifest.json plus
// per-panel panels/<id>-<slug>/{panel.json, traffic.har, query-error.txt}. panelsTotal is the number
// of panels the caller intended to run (before any cap) and truncated reports whether the caller
// capped the panels slice, so the manifest reflects the full picture.
//
// Like Build, captured traffic and error text are recorded VERBATIM -- redaction is intentionally
// deferred (see the harcapture package doc) -- and server logs are omitted (not request-scoped).
func (b *Bundler) BuildDashboard(dashboardJSON json.RawMessage, panels []DashboardPanel, panelsTotal int, truncated bool) ([]byte, error) {
	manifest := dashboardManifest{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		PanelsTotal: panelsTotal,
		Truncated:   truncated,
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

		har, err := collectHAR(p.HARBuffer)
		if err != nil {
			return nil, err
		}
		if len(har) > 0 {
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

// HasCapturedHAR reports whether any HAR traffic was captured for this request (the in-process
// buffer has entries). The handler uses it to decide whether a failed query still has something
// worth bundling.
func HasCapturedHAR(harBuffer *harcapture.Buffer) bool {
	return harBuffer != nil && harBuffer.Len() > 0
}

// collectHAR returns the captured HTTP traffic (from the in-process buffer) as HAR 1.2 JSON.
// Returns (nil, nil) when nothing was captured, and a non-nil error if traffic was captured but
// could not be serialized (so the caller can fail rather than return an empty bundle).
func collectHAR(harBuffer *harcapture.Buffer) ([]byte, error) {
	if harBuffer == nil || harBuffer.Len() == 0 {
		return nil, nil
	}
	return harBuffer.ToHAR()
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
