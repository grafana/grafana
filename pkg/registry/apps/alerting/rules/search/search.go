package search

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
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
	defaultLimit      = 100
	defaultFacetLimit = 50
	maxFacetLimit     = 20000
)

// facetableFields bounds which fields callers may facet on. Faceting is backed
// by the field's keyword index variant, so only fields indexed that way are
// allowed; folder is the one the rule list uses to find rule-bearing folders.
var facetableFields = map[string]bool{
	fieldFolder: true,
}

// Handler serves the rule search custom routes. It builds a ResourceSearchRequest
// from the query string and delegates to a dual-writer-aware search client that
// routes to the legacy or unified backend based on the resource's storage mode.
// One router per kind is held because the dual-writer mode is per resource.
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

func (h *Handler) SearchAlertRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	resp, next, err := h.run(ctx, req, alertrule.ResourceInfo.GroupResource(), nil)
	if err != nil {
		return err
	}
	return writeJSON(w, &model.GetSearchAlertRulesResponse{
		TypeMeta:                listTypeMeta,
		ListMeta:                metav1.ListMeta{Continue: next},
		GetSearchAlertRulesBody: model.GetSearchAlertRulesBody{Items: parseAlertRuleHits(resp), Facets: parseAlertRuleFacets(resp)},
	})
}

func (h *Handler) SearchRecordingRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	resp, next, err := h.run(ctx, req, recordingrule.ResourceInfo.GroupResource(), nil)
	if err != nil {
		return err
	}
	return writeJSON(w, &model.GetSearchRecordingRulesResponse{
		TypeMeta:                    listTypeMeta,
		ListMeta:                    metav1.ListMeta{Continue: next},
		GetSearchRecordingRulesBody: model.GetSearchRecordingRulesBody{Items: parseRecordingRuleHits(resp), Facets: parseRecordingRuleFacets(resp)},
	})
}

func (h *Handler) SearchRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	// Cross-kind: search alert rules with recording rules federated. A type
	// query param can still narrow to a single kind.
	primary := alertrule.ResourceInfo.GroupResource()
	federated := []schema.GroupResource{recordingrule.ResourceInfo.GroupResource()}
	switch req.URL.Query().Get("type") {
	case "alertrule":
		federated = nil
	case "recordingrule":
		primary = recordingrule.ResourceInfo.GroupResource()
		federated = nil
	}
	resp, next, err := h.run(ctx, req, primary, federated)
	if err != nil {
		return err
	}
	return writeJSON(w, &model.GetSearchRulesResponse{
		TypeMeta:           listTypeMeta,
		ListMeta:           metav1.ListMeta{Continue: next},
		GetSearchRulesBody: model.GetSearchRulesBody{Items: parseRuleHits(resp), Facets: parseRuleFacets(resp)},
	})
}

// run builds the search request, dispatches to the mode-routed client for the
// primary kind, and computes the next page token.
func (h *Handler) run(ctx context.Context, req *app.CustomRouteRequest, primary schema.GroupResource, federated []schema.GroupResource) (*resourcepb.ResourceSearchResponse, string, error) {
	searchReq, offset, err := buildSearchRequest(req.URL.Query(), req.ResourceIdentifier.Namespace, primary, federated)
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
	next := ""
	if rows := rowCount(resp); offset+rows < resp.TotalHits {
		next = strconv.FormatInt(offset+rows, 10)
	}
	return resp, next, nil
}

func rowCount(resp *resourcepb.ResourceSearchResponse) int64 {
	if resp.Results == nil {
		return 0
	}
	return int64(len(resp.Results.Rows))
}

var listTypeMeta = metav1.TypeMeta{APIVersion: model.GroupVersion.String(), Kind: "RuleSearchResults"}

func resourceKey(namespace string, gr schema.GroupResource) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource}
}

func buildSearchRequest(q url.Values, namespace string, primary schema.GroupResource, federated []schema.GroupResource) (*resourcepb.ResourceSearchRequest, int64, error) {
	limit := int64(defaultLimit)
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			limit = n
		}
	}
	var offset int64
	if v := q.Get("continueToken"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			offset = n
		}
	}

	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(namespace, primary)},
		Query:   q.Get("q"),
		Limit:   limit,
		Offset:  offset,
	}
	for _, gr := range federated {
		req.Federated = append(req.Federated, resourceKey(namespace, gr))
	}

	add := func(field string, values ...string) {
		vals := nonEmpty(values)
		if len(vals) > 0 {
			req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: field, Operator: "in", Values: vals})
		}
	}
	add(fieldName, q["names"]...)
	add(fieldFolder, q["folders"]...)
	add(fieldDatasourceUIDs, q["datasourceUIDs"]...)
	add(fieldDashboardUID, q.Get("dashboardUID"))
	add(fieldPanelID, q.Get("panelID"))
	add(fieldReceiver, q.Get("receiver"))
	add(fieldNotificationType, q.Get("notificationType"))
	add(fieldRoutingTree, q.Get("routingTree"))
	add(fieldMetric, q.Get("metric"))
	add(fieldTargetDatasourceUID, q.Get("targetDatasourceUID"))
	if v := q.Get("paused"); v != "" {
		req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{Key: fieldPaused, Operator: "=", Values: []string{v}})
	}
	// Group is a controlled metadata label, matched via the label selector.
	if groups := nonEmpty(q["groups"]); len(groups) > 0 {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{Key: model.GroupLabelKey, Operator: "in", Values: groups})
	}
	// Rule labels are matched against the indexed labels field as flattened
	// "key"/"key=value" terms.
	for _, l := range q["labels"] {
		if l != "" {
			req.Options.Fields = append(req.Options.Fields, labelMatcherRequirement(parseLabelMatcher(l)))
		}
	}
	if s := q.Get("sort"); s != "" {
		desc := s[0] == '-'
		req.SortBy = []*resourcepb.ResourceSearchRequest_Sort{{Field: trimSortPrefix(s), Desc: desc}}
	}
	addFacets(req, q)
	return req, offset, nil
}

// addFacets requests term facets for the whitelisted fields named in the query.
// Unknown fields are silently ignored. Facet terms are ordered by count by the
// backend, not alphabetically.
func addFacets(req *resourcepb.ResourceSearchRequest, q url.Values) {
	fields := nonEmpty(q["facet"])
	if len(fields) == 0 {
		return
	}
	limit := int64(defaultFacetLimit)
	if v := q.Get("facetLimit"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			limit = min(n, maxFacetLimit)
		}
	}
	for _, field := range fields {
		if !facetableFields[field] {
			continue
		}
		if req.Facet == nil {
			req.Facet = make(map[string]*resourcepb.ResourceSearchRequest_Facet)
		}
		req.Facet[field] = &resourcepb.ResourceSearchRequest_Facet{Field: field, Limit: limit}
	}
}

// rowReader reads cells from a search result table by column name.
type rowReader struct {
	idx map[string]int
	row *resourcepb.ResourceTableRow
}

func newRowReaders(resp *resourcepb.ResourceSearchResponse) []rowReader {
	if resp.Results == nil {
		return nil
	}
	idx := map[string]int{}
	for i, c := range resp.Results.Columns {
		idx[c.Name] = i
	}
	readers := make([]rowReader, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		readers = append(readers, rowReader{idx: idx, row: row})
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
		_ = json.Unmarshal(r.row.Cells[i], &out)
	}
	return out
}

func (r rowReader) datasourceUIDs() []string {
	var out []string
	if i, ok := r.idx[fieldDatasourceUIDs]; ok && i < len(r.row.Cells) && len(r.row.Cells[i]) > 0 {
		_ = json.Unmarshal(r.row.Cells[i], &out)
	}
	return out
}

func parseAlertRuleHits(resp *resourcepb.ResourceSearchResponse) []model.GetSearchAlertRulesAlertRuleHit {
	rows := newRowReaders(resp)
	hits := make([]model.GetSearchAlertRulesAlertRuleHit, 0, len(rows))
	for _, r := range rows {
		hits = append(hits, model.GetSearchAlertRulesAlertRuleHit{
			Type:             model.GetSearchAlertRulesRuleSearchType(r.str(fieldType)),
			Name:             r.row.Key.GetName(),
			Title:            r.str(fieldTitle),
			Folder:           r.str(fieldFolder),
			Group:            r.strPtr(fieldGroup),
			Interval:         r.strPtr(fieldInterval),
			Paused:           r.boolPtr(fieldPaused),
			Labels:           r.jsonMap(fieldLabels),
			DatasourceUIDs:   r.datasourceUIDs(),
			Annotations:      r.jsonMap(fieldAnnotations),
			For:              r.strPtr(fieldFor),
			KeepFiringFor:    r.strPtr(fieldKeepFiringFor),
			DashboardUID:     r.strPtr(fieldDashboardUID),
			PanelID:          r.int64Ptr(fieldPanelID),
			Receiver:         r.strPtr(fieldReceiver),
			NotificationType: r.strPtr(fieldNotificationType),
			RoutingTree:      r.strPtr(fieldRoutingTree),
		})
	}
	return hits
}

func parseRecordingRuleHits(resp *resourcepb.ResourceSearchResponse) []model.GetSearchRecordingRulesRecordingRuleHit {
	rows := newRowReaders(resp)
	hits := make([]model.GetSearchRecordingRulesRecordingRuleHit, 0, len(rows))
	for _, r := range rows {
		hits = append(hits, model.GetSearchRecordingRulesRecordingRuleHit{
			Type:                model.GetSearchRecordingRulesRuleSearchType(r.str(fieldType)),
			Name:                r.row.Key.GetName(),
			Title:               r.str(fieldTitle),
			Folder:              r.str(fieldFolder),
			Group:               r.strPtr(fieldGroup),
			Interval:            r.strPtr(fieldInterval),
			Paused:              r.boolPtr(fieldPaused),
			Labels:              r.jsonMap(fieldLabels),
			DatasourceUIDs:      r.datasourceUIDs(),
			Metric:              r.strPtr(fieldMetric),
			TargetDatasourceUID: r.strPtr(fieldTargetDatasourceUID),
		})
	}
	return hits
}

// parseRuleHits builds the cross-kind union, discriminating each row by its
// type column into the matching variant.
func parseRuleHits(resp *resourcepb.ResourceSearchResponse) []model.GetSearchRulesRuleHit {
	rows := newRowReaders(resp)
	hits := make([]model.GetSearchRulesRuleHit, 0, len(rows))
	for _, r := range rows {
		hit := model.GetSearchRulesRuleHit{}
		if r.str(fieldType) == "recordingrule" {
			hit.RecordingRuleHit = &model.GetSearchRulesRecordingRuleHit{
				Type:                model.GetSearchRulesRuleSearchTypeRecordingRule,
				Name:                r.row.Key.GetName(),
				Title:               r.str(fieldTitle),
				Folder:              r.str(fieldFolder),
				Group:               r.strPtr(fieldGroup),
				Interval:            r.strPtr(fieldInterval),
				Paused:              r.boolPtr(fieldPaused),
				Labels:              r.jsonMap(fieldLabels),
				DatasourceUIDs:      r.datasourceUIDs(),
				Metric:              r.strPtr(fieldMetric),
				TargetDatasourceUID: r.strPtr(fieldTargetDatasourceUID),
			}
		} else {
			hit.AlertRuleHit = &model.GetSearchRulesAlertRuleHit{
				Type:             model.GetSearchRulesRuleSearchTypeAlertRule,
				Name:             r.row.Key.GetName(),
				Title:            r.str(fieldTitle),
				Folder:           r.str(fieldFolder),
				Group:            r.strPtr(fieldGroup),
				Interval:         r.strPtr(fieldInterval),
				Paused:           r.boolPtr(fieldPaused),
				Labels:           r.jsonMap(fieldLabels),
				DatasourceUIDs:   r.datasourceUIDs(),
				Annotations:      r.jsonMap(fieldAnnotations),
				For:              r.strPtr(fieldFor),
				KeepFiringFor:    r.strPtr(fieldKeepFiringFor),
				DashboardUID:     r.strPtr(fieldDashboardUID),
				PanelID:          r.int64Ptr(fieldPanelID),
				Receiver:         r.strPtr(fieldReceiver),
				NotificationType: r.strPtr(fieldNotificationType),
				RoutingTree:      r.strPtr(fieldRoutingTree),
			}
		}
		hits = append(hits, hit)
	}
	return hits
}

// The three parse*Facets functions map the backend's term facets into each
// route's generated facet type. They mirror the parse*Hits trio: the generated
// types are distinct per route, so the mapping is repeated rather than shared.

func parseAlertRuleFacets(resp *resourcepb.ResourceSearchResponse) map[string]model.GetSearchAlertRulesFacetResult {
	if len(resp.Facet) == 0 {
		return nil
	}
	out := make(map[string]model.GetSearchAlertRulesFacetResult, len(resp.Facet))
	for name, f := range resp.Facet {
		terms := make([]model.GetSearchAlertRulesTermFacet, 0, len(f.Terms))
		for _, t := range f.Terms {
			terms = append(terms, model.GetSearchAlertRulesTermFacet{Term: t.Term, Count: t.Count})
		}
		out[name] = model.GetSearchAlertRulesFacetResult{Field: f.Field, Total: f.Total, Missing: f.Missing, Terms: terms}
	}
	return out
}

func parseRecordingRuleFacets(resp *resourcepb.ResourceSearchResponse) map[string]model.GetSearchRecordingRulesFacetResult {
	if len(resp.Facet) == 0 {
		return nil
	}
	out := make(map[string]model.GetSearchRecordingRulesFacetResult, len(resp.Facet))
	for name, f := range resp.Facet {
		terms := make([]model.GetSearchRecordingRulesTermFacet, 0, len(f.Terms))
		for _, t := range f.Terms {
			terms = append(terms, model.GetSearchRecordingRulesTermFacet{Term: t.Term, Count: t.Count})
		}
		out[name] = model.GetSearchRecordingRulesFacetResult{Field: f.Field, Total: f.Total, Missing: f.Missing, Terms: terms}
	}
	return out
}

func parseRuleFacets(resp *resourcepb.ResourceSearchResponse) map[string]model.GetSearchRulesFacetResult {
	if len(resp.Facet) == 0 {
		return nil
	}
	out := make(map[string]model.GetSearchRulesFacetResult, len(resp.Facet))
	for name, f := range resp.Facet {
		terms := make([]model.GetSearchRulesTermFacet, 0, len(f.Terms))
		for _, t := range f.Terms {
			terms = append(terms, model.GetSearchRulesTermFacet{Term: t.Term, Count: t.Count})
		}
		out[name] = model.GetSearchRulesFacetResult{Field: f.Field, Total: f.Total, Missing: f.Missing, Terms: terms}
	}
	return out
}

func nonEmpty(values []string) []string {
	out := values[:0]
	for _, v := range values {
		if v != "" {
			out = append(out, v)
		}
	}
	return out
}

func trimSortPrefix(s string) string {
	if len(s) > 0 && s[0] == '-' {
		return s[1:]
	}
	return s
}

func errorFromResult(e *resourcepb.ErrorResult) error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{Status: metav1.StatusFailure, Message: e.Message, Code: e.Code}}
}

func writeJSON(w app.CustomRouteResponseWriter, obj any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(obj)
}
