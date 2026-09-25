package search

import (
	"encoding/json"
	"strings"

	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func (c *legacyClient) addStatusValues(r *ngmodels.AlertRule, values map[string]any) {
	if len(r.K8sStatus) == 0 {
		return
	}
	var status map[string]any
	if err := json.Unmarshal(r.K8sStatus, &status); err != nil {
		c.logger.Warn("Failed to decode rule search status; omitting status", "orgID", r.OrgID, "ruleUID", r.UID, "error", err)
		return
	}
	fields := []string{fieldHealth, fieldLastEvaluationTime, fieldLastError, fieldEvaluationDuration}
	if r.Type() != ngmodels.RuleTypeRecording {
		fields = append(fields, fieldState, fieldStateReason)
	}
	// Validate before copying so malformed status never produces a partial result.
	for _, name := range fields {
		value := status[name]
		if value == nil {
			continue
		}
		_, valid := value.(string)
		if name == fieldEvaluationDuration {
			_, valid = value.(float64)
		}
		if !valid {
			c.logger.Warn("Invalid rule search status field type; omitting status", "orgID", r.OrgID, "ruleUID", r.UID, "field", name)
			return
		}
	}
	for _, name := range fields {
		if value := status[name]; value != nil {
			values[name] = value
		}
	}
}

func ruleTypeForResource(req *resourcepb.ResourceSearchRequest) string {
	if req.Options.GetKey().GetResource() == recordingrule.ResourceInfo.GroupResource().Resource {
		return ruleTypeRecording
	}
	return ruleTypeAlerting
}

func emptyResponse() *resourcepb.ResourceSearchResponse {
	return &resourcepb.ResourceSearchResponse{
		Results:        &resourcepb.ResourceTable{Columns: resultColumnDefinitions()},
		TotalHitsExact: true,
	}
}

func matchSourceDatasourceUIDs(r *ngmodels.AlertRule, wanted []string) bool {
	if len(wanted) == 0 {
		return true
	}
	available := make(map[string]struct{})
	for _, uid := range sourceDatasourceUIDs(r) {
		available[uid] = struct{}{}
	}
	for _, uid := range wanted {
		if _, ok := available[uid]; ok {
			return true
		}
	}
	return false
}

// matchNotificationTypeExclude reports whether r's notification type is
// outside exclude. A NotIn filter on notificationType is applied in memory
// (see filters.notificationTypeExclude) because it must carry more than one
// excluded value: excluding both known types is how "default policy" (no
// notification settings) is expressed, and the store's exclude filter for this
// field only ever pushed down one value.
func matchNotificationTypeExclude(r *ngmodels.AlertRule, exclude []string) bool {
	if len(exclude) == 0 {
		return true
	}
	_, notificationType, _ := notificationFields(r.NotificationSettings)
	for _, v := range exclude {
		if notificationType == v {
			return false
		}
	}
	return true
}

func matchTitle(r *ngmodels.AlertRule, query string) bool {
	title := strings.ToLower(r.Title)
	for _, term := range titleSearchTerms(query) {
		if !strings.Contains(title, term) {
			return false
		}
	}
	return true
}

func titleSearchTerms(query string) []string {
	const minTermBytes = 3
	words := strings.Fields(strings.ToLower(query))
	terms := make([]string, 0, len(words))
	for _, word := range words {
		if len(word) >= minTermBytes {
			terms = append(terms, word)
		}
	}
	if len(terms) == 0 {
		return words
	}
	return terms
}
