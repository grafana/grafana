package search

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	prom_model "github.com/prometheus/common/model"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/searchencoding"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// legacyClient implements resourcepb.ResourceIndexClient over the provisioning
// AlertRuleService (the ngalert SQL store). It is the legacy half of the
// dual-writer-aware search router; selector-expressible filters are pushed to
// the service and the rest (free-text title, label matchers, source datasource)
// are applied in memory, mirroring the unified backend's result shape.
type legacyClient struct {
	resourcepb.ResourceIndexClient
	service provisioning.AlertRuleService
	logger  log.Logger
}

func NewLegacyClient(service provisioning.AlertRuleService) *legacyClient {
	logger := log.New("alerting.rules.search.legacy")

	// Surface a degraded result table at startup. Both conditions are schema
	// bugs the tests should have caught, so report them where an operator can
	// see them rather than letting hits quietly lose fields.
	if len(results.skipped) > 0 {
		logger.Warn("rule search result columns dropped: no declared search field", "columns", results.skipped)
	}
	if results.err != nil {
		logger.Error("rule search result table could not be built; legacy search will fail", "error", results.err)
	}
	return &legacyClient{service: service, logger: logger}
}

func (c *legacyClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	f, err := extractFilters(req)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	// singleKind is false only for the deprecated cross-kind /search route
	// (search.go), the one caller that federates recording rules onto an alert
	// rule request (or vice versa) via req.Federated. Both per-resource routes --
	// the compatibility .../searchRules and the generic .../search this backs
	// today -- always search one kind and never set it.
	singleKind := len(req.Federated) == 0
	if singleKind && f.ruleType != "" && f.ruleType != ruleTypeForResource(req) {
		return emptyResponse(), nil
	}
	rules, _, _, err := c.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:                  ruleTypeForRequest(req),
		RuleUIDs:                  f.names,
		GroupFilter:               provisioning.ListRuleStringFilter{Include: f.groupsInclude, Exclude: f.groupsExclude},
		FolderFilter:              provisioning.ListRuleStringFilter{Include: f.folders, Exclude: f.foldersExclude},
		PausedFilter:              provisioning.ListRuleBoolFilter{Value: f.paused},
		DashboardFilter:           stringFilter(f.dashboardUID),
		PanelIDFilter:             stringFilter(f.panelID),
		NotificationTypeFilter:    stringFilter(f.notificationType),
		ReceiverFilter:            stringFilter(f.receiver),
		RoutingTreeFilter:         stringFilter(f.routingTree),
		MetricFilter:              stringFilter(f.metric),
		TargetDatasourceUIDFilter: stringFilter(f.targetDatasourceUID),
		DatasourceUIDs:            f.datasourceUIDs,
		SearchTitle:               f.title,
	})
	if err != nil {
		return nil, err
	}

	filtered := rules[:0]
	for _, r := range rules {
		if singleKind && !matchTitle(r, f.title) {
			continue
		}
		if !matchLabels(r, f.labelMatchers) {
			continue
		}
		if singleKind && !matchSourceDatasourceUIDs(r, f.datasourceUIDs) {
			continue
		}
		if singleKind && !matchNotificationTypeExclude(r, f.notificationTypeExclude) {
			continue
		}
		filtered = append(filtered, r)
	}
	if singleKind {
		perKindSortRules(filtered, f.sortField, f.sortDesc)
	} else {
		sortRules(filtered, f.sortField, f.sortDesc)
	}

	total := len(filtered)
	start, err := legacyResumeIndex(filtered, req)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	page := applyOffset(filtered, start, req.Limit)

	table := &resourcepb.ResourceTable{Columns: resultColumnDefinitions()}
	for _, r := range page {
		values := ruleColumnValues(r)
		if singleKind {
			c.addStatusValues(r, values)
		}
		cells, err := ruleCells(values)
		if err != nil {
			return nil, err
		}
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{
			Key:        ruleKey(req.Options.GetKey().GetNamespace(), r),
			Cells:      cells,
			SortFields: []string{legacySortKey(r)},
		})
	}
	// ListAlertRules restricts the query to folders the caller can read, so total
	// counts authorized rules exactly rather than bounding them from above.
	return &resourcepb.ResourceSearchResponse{Results: table, TotalHits: int64(total), TotalHitsExact: true}, nil
}

// legacySortKey is the composite key filtered rows are ordered by. It is
// opaque outside this package: the generic /search route's cursor and the
// per-kind /searchRules route's offset cursor both wrap it (see
// legacyResumeIndex), but neither inspects it. Title-then-UID mirrors
// perKindSortRules/sortRules, so the same key totally orders the rows those
// functions already sort by, letting a resume search for it with a plain
// string comparison.
func legacySortKey(r *ngmodels.AlertRule) string {
	return strings.ToLower(r.Title) + "\x1f" + r.UID
}

// legacyResumeIndex resolves the row to resume paging from. The per-kind
// /searchRules route always pages by offset (req.Offset, see
// per_kind_query.go); the generic /search route instead pages by the last
// page's sort values (req.SearchAfter, see
// pkg/registry/apis/search/translate.go's decodeContinue), since the legacy
// backend was never taught the generic route's offset field. Resolving both
// here, against the same freshly filtered-and-sorted slice, keeps the two
// routes' pages correct even when they are used against a changing rule set.
func legacyResumeIndex(rules []*ngmodels.AlertRule, req *resourcepb.ResourceSearchRequest) (int64, error) {
	if len(req.SearchAfter) == 0 {
		return req.Offset, nil
	}
	cursor := req.SearchAfter[0]
	desc := len(req.SortBy) > 0 && req.SortBy[0].Desc
	idx := sort.Search(len(rules), func(i int) bool {
		key := legacySortKey(rules[i])
		if desc {
			return key < cursor
		}
		return key > cursor
	})
	return int64(idx), nil
}

func ruleKey(namespace string, r *ngmodels.AlertRule) *resourcepb.ResourceKey {
	res := alertrule.ResourceInfo
	if r.Type() == ngmodels.RuleTypeRecording {
		res = recordingrule.ResourceInfo
	}
	gr := res.GroupResource()
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource, Name: r.UID}
}

// ruleColumnValues maps a rule onto the declared search columns, keyed by
// column name. Values are in their native Go type — the column's encoder turns
// them into cells — so this must not pre-format them as strings: a "42" written
// into the int64 panelID column would be read back as a big-endian int64.
func ruleColumnValues(r *ngmodels.AlertRule) map[string]any {
	receiver, notificationType, routingTree := notificationFields(r.NotificationSettings)

	vals := map[string]any{
		fieldType:             ruleType(r),
		fieldTitle:            r.Title,
		fieldFolder:           r.NamespaceUID,
		fieldInterval:         promDuration(time.Duration(r.IntervalSeconds) * time.Second),
		fieldPaused:           r.IsPaused,
		fieldFor:              promDurationOrEmpty(r.For),
		fieldKeepFiringFor:    promDurationOrEmpty(r.KeepFiringFor),
		fieldReceiver:         receiver,
		fieldNotificationType: notificationType,
		fieldRoutingTree:      routingTree,
	}

	// labels and annotations go through the shared encoding so the legacy rows
	// carry exactly what the unified index holds: labels flattened to matchable
	// terms, annotations kept whole as a JSON object.
	if terms := searchencoding.LabelTerms(r.Labels); len(terms) > 0 {
		vals[fieldLabels] = terms
	}
	if a := searchencoding.AnnotationsJSON(r.Annotations); a != "" {
		vals[fieldAnnotations] = a
	}
	if uids := sourceDatasourceUIDs(r); len(uids) > 0 {
		vals[fieldDatasourceUIDs] = uids
	}
	if r.DashboardUID != nil {
		vals[fieldDashboardUID] = *r.DashboardUID
	}
	if r.PanelID != nil {
		vals[fieldPanelID] = *r.PanelID
	}
	if r.Record != nil {
		vals[fieldMetric] = r.Record.Metric
		vals[fieldTargetDatasourceUID] = r.Record.TargetDatasourceUID
	}
	return vals
}

// ruleCells encodes a rule into the result table's cells. Positions come from
// the column index rather than the literal order of this function, so adding a
// column cannot silently misalign the rest of the row.
func ruleCells(values map[string]any) ([][]byte, error) {
	if results.err != nil {
		return nil, results.err
	}
	cells := make([][]byte, len(results.defs))
	for name, v := range values {
		i, ok := results.index[name]
		if !ok {
			// skip undefined columns instead of failing
			// This should never happnen in practice
			continue
		}
		cell, err := results.encoders[i](v)
		if err != nil {
			return nil, fmt.Errorf("encoding rule search column %q: %w", name, err)
		}
		cells[i] = cell
	}
	return cells, nil
}

func promDuration(d time.Duration) string {
	return prom_model.Duration(d).String()
}

func promDurationOrEmpty(d time.Duration) string {
	if d <= 0 {
		return ""
	}
	return promDuration(d)
}

// notificationFields maps the rule's notification settings to the receiver,
// notification type, and routing tree displayed on a hit.
func notificationFields(ns *ngmodels.NotificationSettings) (receiver, notificationType, routingTree string) {
	if ns == nil {
		return "", "", ""
	}
	if ns.ContactPointRouting != nil {
		return ns.ContactPointRouting.Receiver, string(ngmodels.NotificationSettingsTypeSimplifiedRouting), ""
	}
	if ns.PolicyRouting != nil {
		return "", string(ngmodels.NotificationSettingsTypeNamedRoutingTree), ns.PolicyRouting.Policy
	}
	return "", "", ""
}

func ruleType(r *ngmodels.AlertRule) string {
	if r.Type() == ngmodels.RuleTypeRecording {
		return "recordingrule"
	}
	return "alertrule"
}

func ruleTypeForRequest(req *resourcepb.ResourceSearchRequest) ngmodels.RuleTypeFilter {
	resourceName := req.Options.GetKey().GetResource()
	// A federated request (cross-kind /search) carries the other kind too.
	if len(req.Federated) > 0 {
		return ngmodels.RuleTypeFilterAll
	}
	if resourceName == recordingrule.ResourceInfo.GroupResource().Resource {
		return ngmodels.RuleTypeFilterRecording
	}
	return ngmodels.RuleTypeFilterAlerting
}

func applyOffset(rules []*ngmodels.AlertRule, offset, limit int64) []*ngmodels.AlertRule {
	if offset < 0 {
		offset = 0
	}
	if offset > int64(len(rules)) {
		offset = int64(len(rules))
	}
	rules = rules[offset:]
	if limit > 0 && int64(len(rules)) > limit {
		rules = rules[:limit]
	}
	return rules
}

// sourceDatasourceUIDs returns the distinct source datasource UIDs referenced by
// the rule's query expressions (excluding server-side expression datasources).
func sourceDatasourceUIDs(r *ngmodels.AlertRule) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, q := range r.Data {
		if !isQueryDatasource(q.DatasourceUID) {
			continue
		}
		if _, ok := seen[q.DatasourceUID]; ok {
			continue
		}
		seen[q.DatasourceUID] = struct{}{}
		out = append(out, q.DatasourceUID)
	}
	return out
}
