// Package search serves the per-kind rule search routes,
// POST .../namespaces/{ns}/alertrules/searchRules and
// .../recordingrules/searchRules.
//
// The contract is search.grafana.app/v0alpha1 SearchQuery / SearchResults: the
// same request and response bodies as the generic per-resource search API. It
// is served on a distinct path because rules still come from the legacy ngalert
// store for dual-writer modes 0-3, and the compatibility route must coexist
// with generic search during migration.
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
	searchapi "github.com/grafana/grafana/pkg/registry/apis/search"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

const (
	// Keep the same page-size bounds as the generic search API.
	perKindDefaultLimit = searchapi.DefaultLimit
	perKindMaxLimit     = searchapi.MaxLimit
	// Bound body reads to avoid consuming unbounded input.
	perKindMaxBodyBytes = 1 << 20
)

type perKind struct {
	info   utils.ResourceInfo
	fields *perKindFieldSet
	client *dualwrite.Selector[Backend]
}

func (k perKind) groupResource() schema.GroupResource { return k.info.GroupResource() }

func newPerKind(info utils.ResourceInfo, client *dualwrite.Selector[Backend]) perKind {
	return perKind{info: info, fields: perKindFieldSets[info.GroupResource()], client: client}
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

func (h *Handler) SearchAlertRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return h.search(ctx, w, req, newPerKind(alertrule.ResourceInfo, h.alertRules))
}

func (h *Handler) SearchRecordingRules(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest) error {
	return h.search(ctx, w, req, newPerKind(recordingrule.ResourceInfo, h.recordingRules))
}

func (h *Handler) search(ctx context.Context, w app.CustomRouteResponseWriter, req *app.CustomRouteRequest, k perKind) error {
	namespace, err := requestNamespace(req)
	if err != nil {
		return err
	}
	query, err := decodePerKindSearchQuery(req)
	if err != nil {
		return err
	}
	leaves, ferrs := validatePerKindQuery(query, k)
	if len(ferrs) > 0 {
		return invalidQuery(ferrs)
	}

	t := buildPerKindSearchRequest(query, leaves, namespace, k)
	backend, err := k.client.Resolve(ctx)
	if err != nil {
		return err
	}
	resp, err := backend.Search(ctx, t.req)
	if err != nil {
		h.logger.FromContext(ctx).Error("rule search backend request failed",
			"namespace", namespace, "group", k.groupResource().Group,
			"resource", k.groupResource().Resource, "client", fmt.Sprintf("%T", backend), "error", err)
		return err
	}
	out := &searchv0.SearchResults{
		TypeMeta: metaForKind(searchv0.KindSearchResults),
		Metadata: searchv0.ResultsMetadata{
			Continue:          nextPageToken(resp, t.offset),
			TotalHits:         resp.TotalHits,
			TotalHitsRelation: totalHitsRelation(resp.TotalHitsExact),
		},
		Items: resultItems(resp, t.fields, k),
	}
	return writePerKindJSON(w, out)
}

// Report errors against the search envelope, not the rule kind being searched.
func invalidQuery(errs field.ErrorList) error {
	return apierrors.NewInvalid(schema.GroupKind{Group: searchv0.GROUP, Kind: searchv0.KindSearchQuery}, "", errs)
}

func decodePerKindSearchQuery(req *app.CustomRouteRequest) (*searchv0.SearchQuery, error) {
	if req.Body == nil {
		return nil, apierrors.NewBadRequest("request body is empty")
	}
	// The runner must be able to release the connection even after a partial read.
	defer func() { _ = req.Body.Close() }()
	raw, err := io.ReadAll(io.LimitReader(req.Body, perKindMaxBodyBytes+1))
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("reading search request body: %s", err))
	}
	if int64(len(raw)) > perKindMaxBodyBytes {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("search request body exceeds %d bytes", perKindMaxBodyBytes))
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
	if err := dec.Decode(&json.RawMessage{}); !errors.Is(err, io.EOF) {
		return nil, apierrors.NewBadRequest("request body must contain a single JSON object")
	}
	return &query, nil
}

// An inexact total cannot prove the page was the last one; allow one more request.
func nextPageToken(resp *Result, offset int64) string {
	rows := int64(len(resp.Hits))
	if rows == 0 || (resp.TotalHitsExact && offset+rows >= resp.TotalHits) {
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

func resultItems(resp *Result, fields []string, k perKind) []searchv0.ResultItem {
	wanted := requestedFields(fields)
	items := make([]searchv0.ResultItem, 0, len(resp.Hits))
	for _, hit := range resp.Hits {
		item := searchv0.ResultItem{Resource: searchv0.ResourceRef{
			Group: k.groupResource().Group, Resource: k.groupResource().Resource,
			Kind: k.info.GroupVersionKind().Kind, Name: hit.Name,
		}}
		values := map[string]any{}
		for name, value := range hit.Values {
			if wanted[name] {
				values[name] = value
			}
		}
		if len(values) > 0 {
			item.Fields = &common.Unstructured{Object: values}
		}
		items = append(items, item)
	}
	return items
}

func requestedFields(fields []string) map[string]bool {
	wanted := make(map[string]bool, len(fields))
	for _, name := range fields {
		wanted[name] = true
	}
	return wanted
}

func metaForKind(kindName string) metav1.TypeMeta {
	return metav1.TypeMeta{APIVersion: searchv0.APIVERSION, Kind: kindName}
}

func writePerKindJSON(w app.CustomRouteResponseWriter, obj any) error {
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(obj); err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(body.Bytes())
	return err
}
