// Package search serves the per-kind rule search routes,
// POST .../namespaces/{ns}/alertrules/search and .../recordingrules/search.
//
// The contract is search.grafana.app/v0alpha1 SearchQuery / SearchResults: the
// same paths, operation IDs, request bodies and response bodies as the generic
// per-resource search API. It is served here rather than by that API because
// rules still come from the legacy ngalert store for dual-writer modes 0-3, and
// the generic query translator cannot express what that store can and cannot do.
// Adopting the generic endpoint later should be a wiring change, not a breaking
// one, so nothing in this package may diverge from that contract.
package search

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-app-sdk/app"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	// The page size bounds are taken from the generic search API rather than
	// restated, so a client's limit is clamped to the same numbers here and there.
	// The cap also matters on its own: the legacy backend loads and filters the
	// full rule set in memory before paginating, so an unbounded limit would let
	// one request materialize an entire tenant's rules.
	defaultLimit = searchapi.DefaultLimit
	maxLimit     = searchapi.MaxLimit

	// maxBodyBytes bounds the search request body. The where tree is small; this
	// guards against a client streaming an unbounded body into the decoder.
	maxBodyBytes = 1 << 20 // 1 MiB
)

// kind is the rule kind one search endpoint serves: its identity, the fields a
// query may reference on it, and the index client to search it with. One client
// per kind because the dual-writer storage mode is per resource.
type kind struct {
	info   utils.ResourceInfo
	fields *fieldSet
	client resourcepb.ResourceIndexClient
}

func (k kind) groupResource() schema.GroupResource {
	return k.info.GroupResource()
}

// Handler serves the rule search custom routes. Each route decodes a SearchQuery
// POST body into a ResourceSearchRequest and delegates to a dual-writer-aware
// search client that routes to the legacy or unified backend based on the
// resource's storage mode.
type Handler struct {
	alertRules     kind
	recordingRules kind
	logger         log.Logger
}

func NewHandler(alertRules, recordingRules resourcepb.ResourceIndexClient) *Handler {
	return &Handler{
		alertRules:     newKind(alertrule.ResourceInfo, alertRules),
		recordingRules: newKind(recordingrule.ResourceInfo, recordingRules),
		logger:         log.New("alerting.rules.search"),
	}
}

func newKind(info utils.ResourceInfo, client resourcepb.ResourceIndexClient) kind {
	return kind{info: info, fields: fieldSets[info.GroupResource()], client: client}
}

func requestNamespace(req *app.CustomRouteRequest) (string, error) {
	namespace := req.ResourceIdentifier.Namespace
	if namespace == "" {
		return "", apierrors.NewBadRequest("namespace is required")
	}
	if namespace == "*" {
		return "", apierrors.NewBadRequest("searching across namespaces is not supported")
	}
	return namespace, nil
}

// SearchAlertRules serves POST .../alertrules/search.
func (h *Handler) SearchAlertRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return h.search(ctx, w, req, h.alertRules)
}

// SearchRecordingRules serves POST .../recordingrules/search.
func (h *Handler) SearchRecordingRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return h.search(ctx, w, req, h.recordingRules)
}

// search is the flow both routes share; only the kind differs.
func (h *Handler) search(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest, k kind) error {
	namespace, err := requestNamespace(req)
	if err != nil {
		return err
	}
	query, err := decodeSearchQuery(req)
	if err != nil {
		return err
	}

	leaves, ferrs := validateQuery(query, k)
	if len(ferrs) > 0 {
		return invalidQuery(ferrs)
	}

	t := translateQuery(query, leaves, namespace, k)
	resp, err := k.client.Search(ctx, t.req)
	if err != nil {
		h.logger.FromContext(ctx).Error("rule search backend request failed",
			"namespace", namespace, "group", k.groupResource().Group,
			"resource", k.groupResource().Resource, "client", fmt.Sprintf("%T", k.client), "error", err)
		return err
	}
	// The backend reports failures in the payload, not as a transport error.
	if resp.GetError() != nil {
		err = resource.GetError(resp.GetError())
		h.logger.FromContext(ctx).Error("rule search backend returned an error",
			"namespace", namespace, "group", k.groupResource().Group,
			"resource", k.groupResource().Resource, "client", fmt.Sprintf("%T", k.client), "error", err)
		return err
	}

	out, err := h.results(ctx, namespace, resp, t, k)
	if err != nil {
		h.logger.FromContext(ctx).Error("rule search response mapping failed",
			"namespace", namespace, "group", k.groupResource().Group,
			"resource", k.groupResource().Resource, "error", err)
		return err
	}
	return writeJSON(w, out)
}

// invalidQuery reports a rejected query the way the generic search API reports
// one: a 422 naming the offending fields, attributed to the envelope's own kind
// rather than to the rule kind being searched.
func invalidQuery(errs field.ErrorList) error {
	return apierrors.NewInvalid(schema.GroupKind{Group: searchv0.GROUP, Kind: searchv0.KindSearchQuery}, "", errs)
}

// decodeSearchQuery reads and parses the SearchQuery POST body. A body is
// required: the envelope's apiVersion and kind identify what is being asked for,
// so there is no meaningful empty request.
func decodeSearchQuery(req *app.CustomRouteRequest) (*searchv0.SearchQuery, error) {
	if req.Body == nil {
		return nil, apierrors.NewBadRequest("request body is empty")
	}
	// The reader owns the body: close it so the runner can release the underlying
	// connection even when the handler consumes only part of it.
	defer func() { _ = req.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(req.Body, maxBodyBytes+1))
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("reading search request body: %s", err))
	}
	if int64(len(raw)) > maxBodyBytes {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("search request body exceeds %d bytes", maxBodyBytes))
	}

	var query searchv0.SearchQuery
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&query); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, apierrors.NewBadRequest("request body is empty")
		}
		return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid request body: %s", err))
	}
	// Anything after the first value means the caller sent something other than
	// the single query about to be acted on.
	if err := dec.Decode(&json.RawMessage{}); !errors.Is(err, io.EOF) {
		return nil, apierrors.NewBadRequest("request body must contain a single JSON object")
	}
	return &query, nil
}

// results maps a backend response onto the public envelope.
func (h *Handler) results(ctx context.Context, namespace string, resp *resourcepb.ResourceSearchResponse, t translated, k kind) (*searchv0.SearchResults, error) {
	items, err := h.resultItems(ctx, namespace, resp, t.fields, k)
	if err != nil {
		return nil, err
	}
	return &searchv0.SearchResults{
		TypeMeta: metaForKind(searchv0.KindSearchResults),
		Metadata: searchv0.ResultsMetadata{
			Continue:          nextPageToken(resp, t.offset),
			TotalHits:         resp.GetTotalHits(),
			TotalHitsRelation: totalHitsRelation(resp.GetTotalHitsExact()),
		},
		Items: items,
	}, nil
}

// nextPageToken offers a cursor when more results may exist. An inexact total
// cannot prove a non-empty page was the last one, so it may produce one extra
// empty request rather than making authorized results unreachable.
//
// Offset paging rather than the generic search API's sort-value cursor, because
// rows from the legacy backend carry no sort values. The token is opaque either
// way, so which one it is stays invisible to the client. Correct only while each
// backend paginates one globally-ordered set: pages ordered differently would
// skip or duplicate rows.
func nextPageToken(resp *resourcepb.ResourceSearchResponse, offset int64) string {
	rows := int64(len(resp.GetResults().GetRows()))
	if rows == 0 || (resp.GetTotalHitsExact() && offset+rows >= resp.GetTotalHits()) {
		return ""
	}
	return encodeCursor(offset + rows)
}

func totalHitsRelation(exact bool) searchv0.TotalHitsRelation {
	if exact {
		return searchv0.TotalHitsEqual
	}
	return searchv0.TotalHitsAtMost
}

// resultItems converts the backend result table into envelope items, projected
// down to the requested fields.
//
// The values are the decoded index values, unshaped: labels arrive as the
// flattened key / key=value terms the index holds and annotations as a JSON
// string, because that is what the generic endpoint will return for the same
// fields. Re-shaping them into maps here would make the response change at
// migration even though the schema would not.
func (h *Handler) resultItems(ctx context.Context, namespace string, resp *resourcepb.ResourceSearchResponse, fields []string, k kind) ([]searchv0.ResultItem, error) {
	table := resp.GetResults()
	rows := table.GetRows()
	cols := table.GetColumns()

	// Resolved once per response rather than per row.
	wanted := make(map[string]bool, len(fields))
	for _, name := range fields {
		wanted[name] = true
	}

	items := make([]searchv0.ResultItem, 0, len(rows))
	for _, row := range rows {
		if len(row.GetCells()) != len(cols) {
			return nil, fmt.Errorf("row has %d cells but the table declares %d columns", len(row.GetCells()), len(cols))
		}
		item := searchv0.ResultItem{
			Resource: searchv0.ResourceRef{
				Group:    k.groupResource().Group,
				Resource: k.groupResource().Resource,
				Kind:     k.info.GroupVersionKind().Kind,
				Name:     row.GetKey().GetName(),
			},
			// Score is intentionally left unset: the legacy backend does not compute
			// relevance, and until both backends populate it consistently a score
			// would be present for unified hits only.
		}
		values := map[string]any{}
		for i, col := range cols {
			if !wanted[col.GetName()] {
				continue
			}
			v, err := resource.DecodeCell(col, i, row.GetCells()[i])
			if err != nil {
				// One unreadable column loses that field rather than failing the
				// whole search, so a schema bug degrades a hit instead of an outage.
				h.logger.FromContext(ctx).Warn("failed to decode rule search result column",
					"namespace", namespace, "group", k.groupResource().Group,
					"resource", k.groupResource().Resource, "column", col.GetName(),
					"rule", row.GetKey().GetName(), "error", err)
				continue
			}
			if v == nil {
				continue
			}
			values[col.GetName()] = v
		}
		if len(values) > 0 {
			item.Fields = &common.Unstructured{Object: values}
		}
		items = append(items, item)
	}
	return items, nil
}

func metaForKind(kindName string) metav1.TypeMeta {
	return metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: kindName}
}

func writeJSON(w app.CustomRouteResponseWriter, obj any) error {
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(obj); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(body.Bytes())
	return err
}
