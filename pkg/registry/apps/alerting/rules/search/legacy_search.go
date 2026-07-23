package search

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	prom_model "github.com/prometheus/common/model"
	"google.golang.org/grpc"

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
	return &legacyClient{service: service, logger: log.New("alerting.rules.search.legacy")}
}

func (c *legacyClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	f := extractFilters(req)
	rules, _, _, err := c.service.ListAlertRules(ctx, user, provisioning.ListAlertRulesOptions{
		RuleType:                  ruleTypeForRequest(req),
		RuleUIDs:                  f.names,
		FolderFilter:              includeFilter(f.folders),
		PausedFilter:              provisioning.ListRuleBoolFilter{Value: f.paused},
		DashboardFilter:           stringFilter(f.dashboardUID),
		PanelIDFilter:             stringFilter(f.panelID),
		NotificationTypeFilter:    stringFilter(f.notificationType),
		ReceiverFilter:            stringFilter(f.receiver),
		RoutingTreeFilter:         stringFilter(f.routingTree),
		MetricFilter:              stringFilter(f.metric),
		TargetDatasourceUIDFilter: stringFilter(f.targetDatasourceUID),
	})
	if err != nil {
		return nil, err
	}

	filtered := rules[:0]
	for _, r := range rules {
		if !matchText(r, f.text) || !matchLabels(r, f.labels) || !matchDatasources(r, f.datasourceUIDs) {
			continue
		}
		filtered = append(filtered, r)
	}
	sortRules(filtered, f.sortField, f.sortDesc)

	total := len(filtered)
	page := applyOffset(filtered, req.Offset, req.Limit)

	table := &resourcepb.ResourceTable{Columns: resultColumnDefinitions()}
	for _, r := range page {
		table.Rows = append(table.Rows, &resourcepb.ResourceTableRow{
			Key:   ruleKey(req.Options.GetKey().GetNamespace(), r),
			Cells: ruleCells(r),
		})
	}
	return &resourcepb.ResourceSearchResponse{Results: table, TotalHits: int64(total)}, nil
}

func ruleKey(namespace string, r *ngmodels.AlertRule) *resourcepb.ResourceKey {
	res := alertrule.ResourceInfo
	if r.Type() == ngmodels.RuleTypeRecording {
		res = recordingrule.ResourceInfo
	}
	gr := res.GroupResource()
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource, Name: r.UID}
}

// ruleCells encodes the result columns for a rule, in resultColumns order.
func ruleCells(r *ngmodels.AlertRule) [][]byte {
	labels, _ := json.Marshal(r.Labels)
	annotations, _ := json.Marshal(r.Annotations)
	datasources, _ := json.Marshal(sourceDatasourceUIDs(r))

	var dashboardUID, panelID, metric, targetDatasourceUID string
	if r.DashboardUID != nil {
		dashboardUID = *r.DashboardUID
	}
	if r.PanelID != nil {
		panelID = strconv.FormatInt(*r.PanelID, 10)
	}
	if r.Record != nil {
		metric = r.Record.Metric
		targetDatasourceUID = r.Record.TargetDatasourceUID
	}
	receiver, notificationType, routingTree := notificationFields(r.NotificationSettings)

	// TODO: see if there is a safer way to make sure the ordering of cells matches the resultColumns definition, without relying on manual maintenance of this function when columns are added/removed/reshuffled.
	return [][]byte{
		[]byte(ruleType(r)),
		[]byte(r.Title),
		[]byte(r.NamespaceUID),
		[]byte(promDuration(time.Duration(r.IntervalSeconds) * time.Second)),
		[]byte(strconv.FormatBool(r.IsPaused)),
		labels,
		datasources,
		annotations,
		[]byte(promDurationOrEmpty(r.For)),
		[]byte(promDurationOrEmpty(r.KeepFiringFor)),
		[]byte(dashboardUID),
		[]byte(panelID),
		[]byte(receiver),
		[]byte(notificationType),
		[]byte(routingTree),
		[]byte(metric),
		[]byte(targetDatasourceUID),
	}
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

func resultColumnDefinitions() []*resourcepb.ResourceTableColumnDefinition {
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(resultColumns))
	for _, name := range resultColumns {
		cols = append(cols, &resourcepb.ResourceTableColumnDefinition{
			Name: name,
			Type: resourcepb.ResourceTableColumnDefinition_STRING,
		})
	}
	return cols
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
		if _, server := serverSideDatasourceUIDs[q.DatasourceUID]; server || q.DatasourceUID == "" {
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
