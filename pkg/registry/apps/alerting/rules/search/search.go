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

const defaultLimit = 100

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
	return h.search(ctx, w, req, alertrule.ResourceInfo.GroupResource(), nil)
}

func (h *Handler) SearchRecordingRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return h.search(ctx, w, req, recordingrule.ResourceInfo.GroupResource(), nil)
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
	return h.search(ctx, w, req, primary, federated)
}

func (h *Handler) search(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest, primary schema.GroupResource, federated []schema.GroupResource) error {
	namespace := req.ResourceIdentifier.Namespace
	searchReq, offset, err := buildSearchRequest(req.URL.Query(), namespace, primary, federated)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	resp, err := h.clientFor(primary).Search(ctx, searchReq)
	if err != nil {
		return err
	}
	if resp.Error != nil {
		return apierrors.NewInternalError(errorFromResult(resp.Error))
	}

	items := parseResults(resp)
	next := ""
	if offset+int64(len(items)) < resp.TotalHits {
		next = strconv.FormatInt(offset+int64(len(items)), 10)
	}

	return writeJSON(w, &model.GetSearchRulesResponse{
		TypeMeta:           metav1.TypeMeta{APIVersion: model.GroupVersion.String(), Kind: "RuleSearchResults"},
		ListMeta:           metav1.ListMeta{Continue: next},
		GetSearchRulesBody: model.GetSearchRulesBody{Items: items},
	})
}

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
	add(fieldFolder, q["folders"]...)
	add(fieldGroup, q["groups"]...)
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
	for _, l := range q["labels"] {
		if l != "" {
			req.Options.Labels = append(req.Options.Labels, matcherToRequirement(parseLabelMatcher(l)))
		}
	}
	if s := q.Get("sort"); s != "" {
		desc := s[0] == '-'
		req.SortBy = []*resourcepb.ResourceSearchRequest_Sort{{Field: trimSortPrefix(s), Desc: desc}}
	}
	return req, offset, nil
}

// parseResults turns the search response table into typed rule hits, reading
// cells by column name so it works for both the legacy and unified backends.
func parseResults(resp *resourcepb.ResourceSearchResponse) []model.GetSearchRulesRuleHit {
	if resp.Results == nil {
		return []model.GetSearchRulesRuleHit{}
	}
	idx := map[string]int{}
	for i, c := range resp.Results.Columns {
		idx[c.Name] = i
	}
	cell := func(row *resourcepb.ResourceTableRow, name string) []byte {
		if i, ok := idx[name]; ok && i < len(row.Cells) {
			return row.Cells[i]
		}
		return nil
	}

	hits := make([]model.GetSearchRulesRuleHit, 0, len(resp.Results.Rows))
	for _, row := range resp.Results.Rows {
		hit := model.GetSearchRulesRuleHit{
			Type:   model.GetSearchRulesRuleSearchType(cell(row, fieldType)),
			Name:   row.Key.GetName(),
			Title:  string(cell(row, fieldTitle)),
			Folder: string(cell(row, fieldFolder)),
		}
		if g := string(cell(row, fieldGroup)); g != "" {
			hit.Group = &g
		}
		if p := string(cell(row, fieldPaused)); p != "" {
			if b, err := strconv.ParseBool(p); err == nil {
				hit.Paused = &b
			}
		}
		if l := cell(row, fieldLabels); len(l) > 0 {
			_ = json.Unmarshal(l, &hit.Labels)
		}
		if d := cell(row, fieldDatasourceUIDs); len(d) > 0 {
			_ = json.Unmarshal(d, &hit.DatasourceUIDs)
		}
		hits = append(hits, hit)
	}
	return hits
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
