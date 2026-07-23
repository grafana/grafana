package search

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	defaultLimit = 100
	// maxLimit caps the page size a client can request. The legacy backend loads
	// and filters the full rule set in memory before paginating, so an unbounded
	// limit would let a single request materialize an entire tenant's rules.
	maxLimit = 1000
	// maxBodyBytes bounds the search request body. The where tree is small; this
	// guards against a client streaming an unbounded body into the decoder.
	maxBodyBytes = 1 << 20 // 1 MiB
)

// Handler serves the rule search custom route. It decodes the SearchQuery POST
// body into a ResourceSearchRequest and delegates to a dual-writer-aware search
// client that routes to the legacy or unified backend based on the resource's
// storage mode. One router per kind is held because the dual-writer mode is per
// resource.
type Handler struct {
	alertRules     resourcepb.ResourceIndexClient
	recordingRules resourcepb.ResourceIndexClient
	logger         log.Logger
}

func NewHandler(alertRules, recordingRules resourcepb.ResourceIndexClient) *Handler {
	return &Handler{alertRules: alertRules, recordingRules: recordingRules, logger: log.New("alerting.rules.search")}
}

// clientFor selects the router for the primary resource being searched.
func (h *Handler) clientFor(primary schema.GroupResource) resourcepb.ResourceIndexClient {
	if primary.Resource == recordingrule.ResourceInfo.GroupResource().Resource {
		return h.recordingRules
	}
	return h.alertRules
}

// SearchRules serves POST /search. It searches alert rules with recording rules
// federated so a single call returns both kinds; a "type" filter leaf in the
// where tree narrows the result to one kind.
func (h *Handler) SearchRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	body, err := decodeSearchQuery(req)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	primary, federated := kindSelection(body)
	resp, next, err := h.run(ctx, body, req.ResourceIdentifier.Namespace, primary, federated)
	if err != nil {
		return err
	}

	out := &model.CreateSearchRulesResponse{
		TypeMeta: searchResultsTypeMeta,
		CreateSearchRulesBody: model.CreateSearchRulesBody{
			Metadata: h.metadata(resp, next),
			Items:    h.parseHits(resp),
		},
	}
	return writeJSON(w, out)
}

// decodeSearchQuery reads and parses the SearchQuery POST body. An empty body is
// treated as an empty query (match everything) so a bare POST /search lists
// rules, mirroring an unfiltered list.
func decodeSearchQuery(req *app.CustomRouteRequest) (model.CreateSearchRulesRequestBody, error) {
	var body model.CreateSearchRulesRequestBody
	if req.Body == nil {
		return body, nil
	}
	// The reader owns the body: close it so the runner can release the
	// underlying connection even when the handler consumes only part of it.
	defer func() { _ = req.Body.Close() }()
	raw, err := io.ReadAll(io.LimitReader(req.Body, maxBodyBytes+1))
	if err != nil {
		return body, fmt.Errorf("reading search request body: %w", err)
	}
	if int64(len(raw)) > maxBodyBytes {
		return body, fmt.Errorf("search request body exceeds %d bytes", maxBodyBytes)
	}
	if len(raw) == 0 {
		return body, nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return body, fmt.Errorf("invalid search request body: %w", err)
	}
	return body, nil
}

// run builds the search request, dispatches to the mode-routed client for the
// primary kind, and computes the next page token.
func (h *Handler) run(ctx context.Context, body model.CreateSearchRulesRequestBody, namespace string, primary schema.GroupResource, federated []schema.GroupResource) (*resourcepb.ResourceSearchResponse, string, error) {
	searchReq, offset, err := buildSearchRequest(body, namespace, primary, federated)
	if err != nil {
		return nil, "", apierrors.NewBadRequest(err.Error())
	}
	resp, err := h.clientFor(primary).Search(ctx, searchReq)
	if err != nil {
		return nil, "", err
	}
	if resp.Error != nil {
		return nil, "", apierrors.NewInternalError(errorFromResult(resp.Error))
	}
	// The continue token is a numeric offset into a single, stably-ordered
	// result set. This is correct only because each backend paginates one
	// globally-ordered set: the legacy backend sorts and paginates the merged
	// alert+recording rows itself, and the unified backend applies one ordering
	// across the federated kinds. If a backend ever returns a differently
	// ordered set between pages, offset paging would skip or duplicate rows.
	next := ""
	if rows := rowCount(resp); offset+rows < resp.TotalHits {
		next = strconv.FormatInt(offset+rows, 10)
	}
	return resp, next, nil
}

// kindSelection decides which kind is primary and which are federated. By
// default alert rules are primary with recording rules federated so both kinds
// are searched. A "type" filter leaf narrows to a single kind: the query then
// targets that kind alone with no federation.
func kindSelection(body model.CreateSearchRulesRequestBody) (schema.GroupResource, []schema.GroupResource) {
	alert := alertrule.ResourceInfo.GroupResource()
	recording := recordingrule.ResourceInfo.GroupResource()
	switch typeFilterValue(body.Where) {
	case "alertrule":
		return alert, nil
	case "recordingrule":
		return recording, nil
	default:
		return alert, []schema.GroupResource{recording}
	}
}

// typeFilterValue returns the value of a "type" filter leaf, or "" when the
// where tree has none. A type filter is validated (In operator, single valid
// kind) before it reaches here, so a present leaf always narrows to one kind.
func typeFilterValue(where *model.CreateSearchRulesRequestSearchWhereNode) string {
	if where == nil {
		return ""
	}
	if leaf := where.Filter; leaf != nil {
		if leaf.Field == fieldType && leaf.Operator == model.CreateSearchRulesRequestSearchFilterLeafOperatorIn && len(leaf.Values) == 1 {
			return leaf.Values[0]
		}
	}
	for i := range where.And {
		if v := typeFilterValue(&where.And[i]); v != "" {
			return v
		}
	}
	return ""
}

func rowCount(resp *resourcepb.ResourceSearchResponse) int64 {
	if resp.Results == nil {
		return 0
	}
	return int64(len(resp.Results.Rows))
}

func (h *Handler) metadata(resp *resourcepb.ResourceSearchResponse, next string) model.CreateSearchRulesSearchResultsMetadata {
	meta := model.CreateSearchRulesSearchResultsMetadata{}
	if next != "" {
		meta.Continue = &next
	}
	if resp != nil {
		total := resp.TotalHits
		meta.TotalHits = &total
	}
	return meta
}

var searchResultsTypeMeta = metav1.TypeMeta{APIVersion: model.GroupVersion.String(), Kind: "RuleSearchResults"}

func resourceKey(namespace string, gr schema.GroupResource) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource}
}

// rowReader reads cells from a search result table by column name.
type rowReader struct {
	idx    map[string]int
	row    *resourcepb.ResourceTableRow
	logger log.Logger
}

func (h *Handler) newRowReaders(resp *resourcepb.ResourceSearchResponse) []rowReader {
	if resp.Results == nil {
		return nil
	}
	idx := map[string]int{}
	for i, c := range resp.Results.Columns {
		idx[c.Name] = i
	}
	readers := make([]rowReader, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		readers = append(readers, rowReader{idx: idx, row: row, logger: h.logger})
	}
	return readers
}

func (r rowReader) str(name string) string {
	if i, ok := r.idx[name]; ok && i < len(r.row.Cells) {
		return string(r.row.Cells[i])
	}
	return ""
}

func (r rowReader) strPtr(name string) *string {
	if v := r.str(name); v != "" {
		return &v
	}
	return nil
}

func (r rowReader) boolPtr(name string) *bool {
	if v := r.str(name); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return &b
		}
	}
	return nil
}

func (r rowReader) int64Ptr(name string) *int64 {
	if v := r.str(name); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return &n
		}
	}
	return nil
}

func (r rowReader) jsonMap(name string) map[string]string {
	var out map[string]string
	if i, ok := r.idx[name]; ok && i < len(r.row.Cells) && len(r.row.Cells[i]) > 0 {
		if err := json.Unmarshal(r.row.Cells[i], &out); err != nil {
			r.logger.Warn("failed to decode rule search result column", "column", name, "rule", r.row.Key.GetName(), "error", err)
		}
	}
	return out
}

func (r rowReader) datasourceUIDs() []string {
	var out []string
	if i, ok := r.idx[fieldDatasourceUIDs]; ok && i < len(r.row.Cells) && len(r.row.Cells[i]) > 0 {
		if err := json.Unmarshal(r.row.Cells[i], &out); err != nil {
			r.logger.Warn("failed to decode rule search result column", "column", fieldDatasourceUIDs, "rule", r.row.Key.GetName(), "error", err)
		}
	}
	return out
}

// parseHits builds the result items. Each hit carries its resource identity
// (group/resource/kind/name) and the per-kind field payload. A row's kind is
// discriminated by its type column, so a federated (cross-kind) response mixes
// both kinds in one list.
func (h *Handler) parseHits(resp *resourcepb.ResourceSearchResponse) []model.CreateSearchRulesSearchResultHit {
	rows := h.newRowReaders(resp)
	hits := make([]model.CreateSearchRulesSearchResultHit, 0, len(rows))
	for _, r := range rows {
		// Score is intentionally left unset: the legacy backend does not compute
		// relevance, and until both backends populate it consistently we omit it
		// rather than return a score for unified hits only.
		hits = append(hits, model.CreateSearchRulesSearchResultHit{
			Resource: r.resource(),
			Fields:   r.fields(),
		})
	}
	return hits
}

// resource reports the identity of a hit. The kind is derived from the type
// column so federated results carry the correct kind per row.
func (r rowReader) resource() model.CreateSearchRulesSearchResultResource {
	info := alertrule.ResourceInfo
	if r.str(fieldType) == "recordingrule" {
		info = recordingrule.ResourceInfo
	}
	gr := info.GroupResource()
	return model.CreateSearchRulesSearchResultResource{
		Group:    gr.Group,
		Resource: gr.Resource,
		Kind:     info.GroupVersionKind().Kind,
		Name:     r.row.Key.GetName(),
	}
}

// fields populates the per-kind field payload. Only the fields relevant to the
// row's kind are set; the union type leaves the rest nil.
func (r rowReader) fields() model.CreateSearchRulesRuleSearchHitFields {
	f := model.CreateSearchRulesRuleSearchHitFields{
		Title:          r.strPtr(fieldTitle),
		Folder:         r.strPtr(fieldFolder),
		Type:           r.strPtr(fieldType),
		Interval:       r.strPtr(fieldInterval),
		Paused:         r.boolPtr(fieldPaused),
		Labels:         r.jsonMap(fieldLabels),
		DatasourceUIDs: r.datasourceUIDs(),
	}
	if r.str(fieldType) == "recordingrule" {
		f.Metric = r.strPtr(fieldMetric)
		f.TargetDatasourceUID = r.strPtr(fieldTargetDatasourceUID)
		return f
	}
	f.Annotations = r.jsonMap(fieldAnnotations)
	f.For = r.strPtr(fieldFor)
	f.KeepFiringFor = r.strPtr(fieldKeepFiringFor)
	f.DashboardUID = r.strPtr(fieldDashboardUID)
	f.PanelID = r.int64Ptr(fieldPanelID)
	f.Receiver = r.strPtr(fieldReceiver)
	f.NotificationType = r.strPtr(fieldNotificationType)
	f.RoutingTree = r.strPtr(fieldRoutingTree)
	return f
}

func errorFromResult(e *resourcepb.ErrorResult) error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{Status: metav1.StatusFailure, Message: e.Message, Code: e.Code}}
}

func writeJSON(w app.CustomRouteResponseWriter, obj any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(obj)
}
