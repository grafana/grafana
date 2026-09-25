package search

import (
	"context"
	"time"

	prom_model "github.com/prometheus/common/model"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/searchencoding"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var _ Backend = (*legacyClient)(nil)

type legacyClient struct {
	service provisioning.AlertRuleService
	logger  log.Logger
}

func NewLegacyClient(service provisioning.AlertRuleService) *legacyClient {
	return &legacyClient{service: service, logger: log.New("alerting.rules.search.legacy")}
}

func (c *legacyClient) Search(ctx context.Context, req *Query) (*Result, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	f := extractFilters(req)
	perKindSearch := req.PerKind
	if perKindSearch && f.ruleType != "" && f.ruleType != ruleTypeForResource(req) {
		return &Result{Hits: []Hit{}, TotalHitsExact: true}, nil
	}
	rules, _, _, err := c.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:                  ruleTypeForRequest(req),
		RuleUIDs:                  f.names,
		GroupFilter:               provisioning.ListRuleStringFilter{Include: f.groupsInclude, Exclude: f.groupsExclude},
		FolderFilter:              includeFilter(f.folders),
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
		if perKindSearch && !matchTitle(r, f.title) {
			continue
		}
		if !matchLabels(r, f.labelMatchers) {
			continue
		}
		if perKindSearch && !matchSourceDatasourceUIDs(r, f.datasourceUIDs) {
			continue
		}
		filtered = append(filtered, r)
	}
	if perKindSearch {
		perKindSortRules(filtered, f.sortField, f.sortDesc)
	} else {
		sortRules(filtered, f.sortField, f.sortDesc)
	}

	total := len(filtered)
	page := applyOffset(filtered, req.Offset, req.Limit)

	hits := make([]Hit, 0, len(page))
	for _, r := range page {
		values := ruleColumnValues(r)
		if perKindSearch {
			c.addStatusValues(r, values)
		}
		// Empty strings were omitted by the old table decoder; retain that API shape.
		for name, value := range values {
			if text, ok := value.(string); ok && text == "" {
				delete(values, name)
			}
		}
		hits = append(hits, Hit{Name: r.UID, Values: values})
	}
	// The provisioning service counts only rules in folders the caller can read.
	return &Result{Hits: hits, TotalHits: int64(total), TotalHitsExact: true}, nil
}

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

func ruleTypeForRequest(req *Query) ngmodels.RuleTypeFilter {
	resourceName := req.Primary.Resource
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
