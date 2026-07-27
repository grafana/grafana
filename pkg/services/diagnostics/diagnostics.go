// Package diagnostics assembles on-demand datasource diagnostic bundles: captured HTTP traffic
// (HAR), QueryData request/results, the panel/dashboard JSON, and the client-captured frontend
// pipeline evidence (transformation input/output frames + applied display context, which only exist
// in the browser). The HTTP handler in pkg/api runs the queries with capture active and delegates
// bundle assembly here.
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
	// maxPostProcessingArtifactBytes caps a single frontend-processing.json, the way
	// maxQueryDataArtifactBytes does querydata.json. Named separately rather than reusing that constant
	// because the two artifacts are budgeted independently and only happen to share a value today --
	// tuning one must not silently move the other.
	maxPostProcessingArtifactBytes = 8 << 20
	// maxDashboardPostProcessingBytes bounds the TOTAL frontend-processing.json across a whole-dashboard
	// bundle, the way maxDashboardQueryDataBytes does for querydata.json -- without it a per-panel cap
	// alone lets an N-panel dashboard contribute N * maxPostProcessingArtifactBytes, all resident at once
	// while the archive is assembled. It matters more here than for query data: this payload is
	// client-supplied, so unlike a query response its size is not a function of anything the server
	// controls. The request body is capped too (maxDashboardDiagnosticsBodyBytes in pkg/api), but that
	// bounds the whole request, not this artifact's share of the archive.
	//
	// Budgeted separately rather than drawn from the query-data pool because the two artifacts answer
	// different questions and a reader usually needs both: sharing one pool would let a data-heavy
	// dashboard consume it on query data (written first) and silently leave every panel's transform
	// evidence out, which is exactly the evidence this artifact exists to provide.
	maxDashboardPostProcessingBytes = 32 << 20
	// minDiagnosticArtifactBytes is the smallest budget worth attempting for a size-bounded artifact:
	// below it not even a truncated form (version + omission markers) fits, so the panel's artifact is
	// skipped up front. Shared by querydata.json and frontend-processing.json, whose marker-only
	// fallbacks are both well under it.
	minDiagnosticArtifactBytes = 256
)

// queryDataArtifactVersion is the schema version stamped into every querydata.json (including its
// truncated fallbacks) so a reader can tell how to interpret the artifact.
const queryDataArtifactVersion = 1

// NewBundler returns a Bundler.
func NewBundler() *Bundler {
	return &Bundler{}
}

// BuildInput is the caller-supplied content for a single-panel bundle. Every field is optional: the
// bundle holds whatever was supplied and omits the rest.
//
// A struct rather than positional parameters because most fields are mutually assignable
// (json.RawMessage, error), so a transposed argument would silently produce a wrong bundle -- the
// panel JSON filed as the frontend evidence, say -- with nothing for the compiler to catch.
type BuildInput struct {
	Resp      *backend.QueryDataResponse // query response, carries external plugins' __har__ frames
	HARBuffer *harcapture.Buffer         // in-process capture buffer for this request's queries

	PanelJSON        json.RawMessage
	DashboardJSON    json.RawMessage
	QueryRequestJSON json.RawMessage // MetricRequest submitted for this request
	PostProcessing   json.RawMessage // client-captured frontend pipeline evidence (transform IO + display)

	// QueryRequestErr is the caller's failure to serialize the request into QueryRequestJSON. Kept
	// separate from QueryErr so it can be recorded rather than silently omitting the request JSON.
	QueryRequestErr error
	QueryErr        error // top-level error running the queries, if any
}

// Build assembles a .tar.gz bundle from the query response, the captured HAR buffer, and the optional
// panel/dashboard JSON and frontend pipeline evidence the client supplied. traffic.har is omitted
// when nothing was captured.
//
// Server logs are intentionally omitted because they are not scoped to this request and would leak
// unrelated activity into a bundle meant for external sharing; they will be tackled in a follow-up.
func (b *Bundler) Build(in BuildInput) ([]byte, error) {
	resp, harBuffer := in.Resp, in.HARBuffer
	queryRequestJSON := in.QueryRequestJSON
	files := map[string][]byte{}

	// queryRequestErr is the caller's failure to serialize the request into queryRequestJSON. Record it
	// so a support engineer can tell the request JSON was omitted because serialization failed rather
	// than silently dropped, mirroring how the per-panel dashboard path records manifest.queryDataError.
	var queryDataErr error
	if in.QueryRequestErr != nil {
		queryDataErr = fmt.Errorf("serialize query request: %w", in.QueryRequestErr)
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

	// No dashboard-wide budget applies on the single-panel path: there is exactly one artifact, so the
	// per-artifact cap is the whole bound.
	if fp, _ := marshalPostProcessingArtifact(in.PostProcessing, maxPostProcessingArtifactBytes); len(fp) > 0 {
		files["frontend-processing.json"] = fp
	}

	har, err := collectHAR(resp, harBuffer)
	if err != nil {
		return nil, err
	}
	if len(har) > 0 {
		files["traffic.har"] = har
	}

	if len(in.PanelJSON) > 0 {
		files["panel.json"] = indentJSON(in.PanelJSON)
	}
	if len(in.DashboardJSON) > 0 {
		files["dashboard.json"] = indentJSON(in.DashboardJSON)
	}

	if in.QueryErr != nil {
		// Recorded verbatim -- redaction is intentionally deferred for this experimental feature
		// (see the harcapture package doc); the error text can embed a request URL with credentials.
		files["query-error.txt"] = []byte(in.QueryErr.Error() + "\n")
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
// last rung holds only fixed-size markers, which keeps it under minDiagnosticArtifactBytes so the
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
	PostProcessing  json.RawMessage            // client-captured frontend pipeline evidence (transform IO + display)
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
	// PostProcessing* mirror the QueryData* trio for frontend-processing.json, so a reader can see
	// which panels carry frontend pipeline evidence -- and which had it truncated or dropped -- from
	// manifest.json alone, without unpacking every panel directory.
	PostProcessingBytes     int    `json:"postProcessingBytes,omitempty"`
	PostProcessingTruncated bool   `json:"postProcessingTruncated,omitempty"`
	PostProcessingError     string `json:"postProcessingError,omitempty"`
	Skipped                 string `json:"skipped,omitempty"`
	Error                   string `json:"error,omitempty"`
	// CaptureError records a failure to serialize this panel's captured traffic. It's kept separate
	// from Error (a query failure) so one unserializable buffer only loses this panel's traffic.har,
	// not the whole multi-panel bundle.
	CaptureError string `json:"captureError,omitempty"`
}

// BuildDashboard assembles a whole-dashboard .tar.gz: a shared dashboard.json and manifest.json plus
// per-panel panels/<id>-<slug>/{panel.json, querydata.json, frontend-processing.json, traffic.har,
// query-error.txt}.
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
	postProcessingBytesRemaining := maxDashboardPostProcessingBytes
	panelJSONByID := indexPanelJSON(dashboardJSON)
	for _, p := range panels {
		entry := manifestPanelEntry{ID: p.ID, Title: p.Title, Datasources: p.Datasources}

		if p.Skipped != "" {
			entry.Skipped = p.Skipped
			// A skipped panel gets no directory, so there is nowhere to write its artifacts. A non-data
			// panel has no query results and therefore no transform pipeline, so the client should not be
			// sending evidence for one -- but if it does, say so in the manifest rather than discarding it
			// without a trace.
			if hasJSONContent(p.PostProcessing) {
				entry.PostProcessingError = "frontend pipeline evidence discarded: panel was not executed"
			}
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
			if queryDataLimit < minDiagnosticArtifactBytes {
				entry.QueryDataTruncated = true
				queryDataErrs = append(queryDataErrs, fmt.Sprintf("remaining dashboard query-data budget (%d bytes) below the %d-byte minimum artifact size", queryDataBytesRemaining, minDiagnosticArtifactBytes))
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

		// frontend-processing.json draws on its own dashboard-wide pool (see
		// maxDashboardPostProcessingBytes) so a large payload on early panels cannot leave later panels
		// with nothing, and N panels cannot multiply the per-panel cap into the whole archive.
		if hasJSONContent(p.PostProcessing) {
			ppLimit := min(maxPostProcessingArtifactBytes, postProcessingBytesRemaining)
			switch {
			case ppLimit < minDiagnosticArtifactBytes:
				entry.PostProcessingTruncated = true
				entry.PostProcessingError = fmt.Sprintf("remaining dashboard post-processing budget (%d bytes) below the %d-byte minimum artifact size", postProcessingBytesRemaining, minDiagnosticArtifactBytes)
			default:
				fp, truncated := marshalPostProcessingArtifact(p.PostProcessing, ppLimit)
				switch {
				case len(fp) == 0:
					// Nothing encodable survived; there is no partial form left to write.
					entry.PostProcessingError = "frontend pipeline evidence could not be encoded"
				case len(fp) > ppLimit:
					// The marker-only rung is returned even when it doesn't fit, because there is nothing
					// further to drop -- so enforce the budget here rather than blowing past it.
					entry.PostProcessingTruncated = true
					entry.PostProcessingError = "frontend-processing artifact exceeded its assigned dashboard budget"
				default:
					files[dir+"/frontend-processing.json"] = fp
					entry.PostProcessingBytes = len(fp)
					entry.PostProcessingTruncated = truncated
					postProcessingBytesRemaining -= len(fp)
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

// postProcessingArtifactVersion is the schema version stamped into the DEGRADED forms of
// frontend-processing.json. An untruncated artifact is the client's own document embedded verbatim and
// is versioned (if at all) by the client, so only the fallbacks below carry this stamp -- which is
// also how a reader distinguishes a Grafana-generated fallback from a client payload that happens to
// have a "truncated" key of its own.
const postProcessingArtifactVersion = 1

// postProcessingArtifact is the degraded form of frontend-processing.json. The frames (input/output)
// are what make the payload large, while the transformation config and display context are small and
// are the fields that let a reader decide "wrong transform config" vs "bad datasource data" -- so they
// are kept verbatim as long as they fit.
type postProcessingArtifact struct {
	Version         int             `json:"version"`
	Transformations json.RawMessage `json:"transformations,omitempty"`
	Display         json.RawMessage `json:"display,omitempty"`
	Truncated       bool            `json:"truncated"`
	// OriginalBytes is the payload as received; IndentedBytes is its pretty-printed size, which is what
	// LimitBytes was compared against. Both are reported because they differ -- a client that already
	// pretty-prints can even shrink under re-indentation -- so a reader checking the artifact against
	// the request body would otherwise be comparing against the wrong number.
	OriginalBytes int `json:"originalBytes"`
	IndentedBytes int `json:"indentedBytes"`
	LimitBytes    int `json:"limitBytes"`
	// The *Omitted flags all mean "the client sent this and it had to be dropped", never "it isn't
	// here": each is set from what the payload actually carried, so a reader can tell a field that
	// didn't fit from one that was never captured and doesn't go hunting for the latter.
	FramesOmitted          bool `json:"framesOmitted,omitempty"`
	TransformationsOmitted bool `json:"transformationsOmitted,omitempty"`
	DisplayOmitted         bool `json:"displayOmitted,omitempty"`
}

// jsonEmptyLiterals are the payloads that are syntactically present but carry nothing: a client with
// nothing to report sends one of these as readily as it omits the field, and an "empty capture"
// artifact (or a manifest error claiming evidence was discarded) is worse than no artifact at all.
//
// Compared with bytes.Equal rather than string(payload) == "null", which would copy the whole
// (potentially multi-megabyte) payload just to reject a few bytes. Interior whitespace ("{ }") is not
// normalized away, since no JSON encoder emits it for an empty container.
var jsonEmptyLiterals = [][]byte{[]byte("null"), []byte("{}"), []byte("[]"), []byte(`""`)}

// hasJSONContent reports whether a raw JSON value carries something worth recording. Shared by
// BuildDashboard's budget gate, marshalPostProcessingArtifact, and the per-field omission flags in
// fitPostProcessingArtifact, so all of them agree on what "nothing" is -- otherwise the gate records a
// budget failure against a panel that sent no evidence, or a flag claims a field didn't fit when the
// client never sent it.
//
// The check is deliberately shallow: it recognizes an empty value, not a structurally empty one. An
// object whose members are all empty ({"input":[],"output":[],"display":null}) counts as content and
// gets an artifact -- and, on a skipped panel, a manifest error saying evidence was discarded. Going
// deeper would mean parsing every payload just to answer the gate, on the hot path for a multi-megabyte
// capture, so the contract is on the client instead: omit postProcessing (or send {}) when nothing was
// captured. See the field doc on diagnosticsRequest.PostProcessing in pkg/api.
func hasJSONContent(raw json.RawMessage) bool {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return false
	}
	for _, empty := range jsonEmptyLiterals {
		if bytes.Equal(trimmed, empty) {
			return false
		}
	}
	return true
}

// marshalPostProcessingArtifact returns the frontend-processing.json bytes for the client-captured
// pipeline evidence plus whether content had to be dropped to fit maxBytes, or (nil, false) when the
// client sent nothing -- an empty container included (see hasJSONContent). The payload is embedded
// verbatim (pretty-printed) when it fits; when it does not, it degrades through
// fitPostProcessingArtifact rather than vanishing behind a bare marker.
//
// Transient peak serialization memory is not yet strictly bounded (same limitation as querydata.json).
func marshalPostProcessingArtifact(raw json.RawMessage, maxBytes int) ([]byte, bool) {
	if !hasJSONContent(raw) {
		return nil, false
	}
	trimmed := bytes.TrimSpace(raw)
	pretty := indentJSON(trimmed)
	if len(pretty) <= maxBytes {
		return pretty, false
	}
	return fitPostProcessingArtifact(trimmed, len(pretty), maxBytes), true
}

// fitPostProcessingArtifact encodes progressively less of the payload -- frames dropped, then display,
// then the transformation config -- and returns the first encoding within maxBytes.
//
// The frames go first because they are the bulk, and the transformation config goes last because it is
// the field that localizes a transform bug: dropping everything the moment the frames don't fit would
// lose the cheap, high-signal evidence in exactly the data-heavy cases this artifact exists to
// explain, the same reasoning marshalQueryDataArtifactWithLimit applies to the submitted query.
//
// The last rung holds only fixed-size markers (well under minDiagnosticArtifactBytes -- pinned by
// TestFitPostProcessingArtifact_markerFloorFitsMinimumBudget) and cannot fail to encode: every
// remaining field is an int or a bool, unlike the rungs above, which embed client JSON verbatim. It is
// returned even if it somehow still doesn't fit, because there is nothing further to drop; callers
// enforcing a hard budget re-check the length.
func fitPostProcessingArtifact(trimmed json.RawMessage, indentedBytes, maxBytes int) []byte {
	artifact := postProcessingArtifact{
		Version:       postProcessingArtifactVersion,
		Truncated:     true,
		OriginalBytes: len(trimmed),
		IndentedBytes: indentedBytes,
		LimitBytes:    maxBytes,
	}

	// Only a JSON object can carry the fields worth keeping; any other shape (array, string, number)
	// has no separable small part, so it goes straight to markers.
	var fields struct {
		Transformations json.RawMessage `json:"transformations"`
		Display         json.RawMessage `json:"display"`
		Input           json.RawMessage `json:"input"`
		Output          json.RawMessage `json:"output"`
	}
	if err := json.Unmarshal(trimmed, &fields); err == nil {
		// Derived from what the payload actually carried rather than assumed: the frames are the bulk this
		// rung drops, but a payload whose weight sits in some other field never had any, and marking them
		// omitted would send a reader looking for evidence the client never captured.
		artifact.FramesOmitted = hasJSONContent(fields.Input) || hasJSONContent(fields.Output)
		// Only content worth keeping is carried over. An empty or null field is not evidence, and
		// embedding it would also make the *Omitted flags below report it as "didn't fit" when the client
		// never sent it -- the exact distinction those flags exist to draw.
		if hasJSONContent(fields.Transformations) {
			artifact.Transformations = fields.Transformations
		}
		if hasJSONContent(fields.Display) {
			artifact.Display = fields.Display
		}
		if out, err := json.MarshalIndent(artifact, "", "  "); err == nil && len(out) <= maxBytes {
			return out
		}

		// Display is dropped before the transformation config: a panel's field config and overrides can
		// themselves be sizeable, while the transform list is the more direct answer to "did a frontend
		// transform do this?".
		artifact.DisplayOmitted = len(artifact.Display) > 0
		artifact.Display = nil
		if out, err := json.MarshalIndent(artifact, "", "  "); err == nil && len(out) <= maxBytes {
			return out
		}

		artifact.TransformationsOmitted = len(artifact.Transformations) > 0
		artifact.Transformations = nil
	}

	// Markers only: both json.RawMessage fields are nil here (either cleared by the ladder above or
	// never set, when the payload wasn't an object), leaving nothing but ints and bools -- so this
	// encode cannot fail and the error is discarded rather than papered over with a literal template
	// that would have to restate every field name and drift from the tags above.
	out, _ := json.MarshalIndent(artifact, "", "  ")
	return out
}
