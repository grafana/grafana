package store

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/infra/db"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// RuleProcessor is a callback function that processes a single rule
// Return false to stop processing
type RuleProcessor func(*ngmodels.AlertRule) (continueProcessing bool)

// StreamedRule contains minimal rule data for streaming
type StreamedRule struct {
	ID           int64
	OrgID        int64
	UID          string
	NamespaceUID string
	RuleGroup    string
	Title        string
	// Lazy-loaded fields - only parsed when needed
	rawData              string
	rawLabels            string
	rawAnnotations       string
	rawNotificationSettings string
	rawMetadata          string
	rawRecord            string
}

// ConversionCache caches parsed JSON data to avoid repeated unmarshaling
type ConversionCache struct {
	mu sync.RWMutex
	// Cache parsed notification settings by raw JSON string
	notificationSettings map[string][]ngmodels.NotificationSettings
	// Cache parsed labels by raw JSON string  
	labels map[string]map[string]string
	// Cache parsed metadata
	metadata map[string]ngmodels.AlertRuleMetadata
}

var conversionCache = &ConversionCache{
	notificationSettings: make(map[string][]ngmodels.NotificationSettings),
	labels:              make(map[string]map[string]string),
	metadata:            make(map[string]ngmodels.AlertRuleMetadata),
}

// StreamAlertRules processes alert rules in a streaming fashion to handle large datasets efficiently
func (st DBstore) StreamAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery, processor RuleProcessor) error {
	return st.SQLStore.WithDbSession(ctx, func(sess *db.Session) error {
		// Build optimized query with minimal columns for initial filtering
		q := sess.Table("alert_rule").
			Select(`id, org_id, uid, namespace_uid, rule_group, title, 
					rule_group_idx, dashboard_uid, panel_id,
					labels, notification_settings, metadata, record`)

		// Apply basic filters at DB level
		if query.OrgID >= 0 {
			q = q.Where("org_id = ?", query.OrgID)
		}

		if len(query.NamespaceUIDs) > 0 {
			args, in := getINSubQueryArgs(query.NamespaceUIDs)
			q = q.Where(fmt.Sprintf("namespace_uid IN (%s)", strings.Join(in, ",")), args...)
		}

		if len(query.RuleUIDs) > 0 {
			args, in := getINSubQueryArgs(query.RuleUIDs)
			q = q.Where(fmt.Sprintf("uid IN (%s)", strings.Join(in, ",")), args...)
		}

		if len(query.RuleGroups) > 0 {
			args, in := getINSubQueryArgs(query.RuleGroups)
			q = q.Where(fmt.Sprintf("rule_group IN (%s)", strings.Join(in, ",")), args...)
		}

		// Order for consistent pagination
		q = q.Asc("namespace_uid", "rule_group", "rule_group_idx", "id")

		// Use Iterate for true streaming - processes one row at a time without loading all into memory
		return q.Iterate(new(alertRule), func(idx int, bean interface{}) error {
			rule := bean.(*alertRule)
			
			// Quick pre-filter before expensive conversion
			if !st.quickFilterCheck(rule, query) {
				return nil // Skip this rule
			}

			// Convert only if needed
			converted, err := st.lazyConvertRule(rule, query)
			if err != nil {
				st.Logger.Error("Failed to convert rule", "uid", rule.UID, "error", err)
				return nil // Skip bad rule but continue processing
			}

			if converted == nil {
				return nil // Filtered out
			}

			// Process the rule
			if !processor(converted) {
				return fmt.Errorf("processing stopped by processor")
			}

			return nil
		})
	})
}

// quickFilterCheck performs cheap filtering before expensive conversions
func (st DBstore) quickFilterCheck(rule *alertRule, query *ngmodels.ListAlertRulesQuery) bool {
	// Check exclude plugins filter using raw labels
	if query.ExcludePlugins && rule.Labels != "" {
		// Quick string contains check before parsing JSON
		if strings.Contains(rule.Labels, "__grafana_origin") {
			return false
		}
	}

	// Check receiver/time interval filters using raw notification settings
	if query.ReceiverName != "" && rule.NotificationSettings != "" {
		if !strings.Contains(rule.NotificationSettings, query.ReceiverName) {
			return false
		}
	}

	if query.TimeIntervalName != "" && rule.NotificationSettings != "" {
		if !strings.Contains(rule.NotificationSettings, query.TimeIntervalName) {
			return false
		}
	}

	return true
}

// lazyConvertRule converts only the fields needed for filtering
func (st DBstore) lazyConvertRule(rule *alertRule, query *ngmodels.ListAlertRulesQuery) (*ngmodels.AlertRule, error) {
	// Start with minimal conversion
	result := &ngmodels.AlertRule{
		ID:              rule.ID,
		OrgID:           rule.OrgID,
		UID:             rule.UID,
		Title:           rule.Title,
		NamespaceUID:    rule.NamespaceUID,
		RuleGroup:       rule.RuleGroup,
		RuleGroupIndex:  rule.RuleGroupIndex,
		Version:         rule.Version,
		IntervalSeconds: rule.IntervalSeconds,
		Updated:         rule.Updated,
		For:             rule.For,
		KeepFiringFor:   rule.KeepFiringFor,
		IsPaused:        rule.IsPaused,
	}

	// Parse labels only if needed for filtering
	if needsLabels(query) {
		labels, err := st.getCachedLabels(rule.Labels)
		if err != nil {
			return nil, err
		}
		result.Labels = labels

		// Apply label filters
		if !matchesLabelFilters(result, query) {
			return nil, nil // Filtered out
		}
	}

	// Parse notification settings only if needed
	if needsNotificationSettings(query) {
		ns, err := st.getCachedNotificationSettings(rule.NotificationSettings)
		if err != nil {
			return nil, err
		}
		result.NotificationSettings = ns

		// Apply notification filters
		if !matchesNotificationFilters(result, query) {
			return nil, nil // Filtered out
		}
	}

	// Parse full data only if absolutely necessary
	if needsFullData(query) {
		var data []ngmodels.AlertQuery
		if err := json.Unmarshal([]byte(rule.Data), &data); err != nil {
			return nil, err
		}
		result.Data = data

		// Apply data source filters
		if !matchesDataSourceFilters(result, query) {
			return nil, nil // Filtered out
		}
	}

	// Apply remaining filters
	if !matchesTextFilters(result, query) {
		return nil, nil
	}

	// Parse remaining fields only for rules that pass all filters
	if err := st.completeRuleConversion(rule, result); err != nil {
		return nil, err
	}

	return result, nil
}

// getCachedLabels returns cached parsed labels or parses and caches them
func (st DBstore) getCachedLabels(rawLabels string) (map[string]string, error) {
	if rawLabels == "" {
		return nil, nil
	}

	conversionCache.mu.RLock()
	if cached, ok := conversionCache.labels[rawLabels]; ok {
		conversionCache.mu.RUnlock()
		return cached, nil
	}
	conversionCache.mu.RUnlock()

	var labels map[string]string
	if err := json.Unmarshal([]byte(rawLabels), &labels); err != nil {
		return nil, err
	}

	conversionCache.mu.Lock()
	conversionCache.labels[rawLabels] = labels
	conversionCache.mu.Unlock()

	return labels, nil
}

// getCachedNotificationSettings returns cached parsed notification settings
func (st DBstore) getCachedNotificationSettings(rawNS string) ([]ngmodels.NotificationSettings, error) {
	if rawNS == "" {
		return nil, nil
	}

	conversionCache.mu.RLock()
	if cached, ok := conversionCache.notificationSettings[rawNS]; ok {
		conversionCache.mu.RUnlock()
		return cached, nil
	}
	conversionCache.mu.RUnlock()

	var ns []ngmodels.NotificationSettings
	if err := json.Unmarshal([]byte(rawNS), &ns); err != nil {
		return nil, err
	}

	conversionCache.mu.Lock()
	conversionCache.notificationSettings[rawNS] = ns
	conversionCache.mu.Unlock()

	return ns, nil
}

// completeRuleConversion fills in remaining fields after filtering
func (st DBstore) completeRuleConversion(src *alertRule, dst *ngmodels.AlertRule) error {
	// Parse annotations if not already done
	if dst.Annotations == nil && src.Annotations != "" {
		if err := json.Unmarshal([]byte(src.Annotations), &dst.Annotations); err != nil {
			return fmt.Errorf("failed to parse annotations: %w", err)
		}
	}

	// Parse metadata if present
	if src.Metadata != "" {
		if err := json.Unmarshal([]byte(src.Metadata), &dst.Metadata); err != nil {
			return fmt.Errorf("failed to parse metadata: %w", err)
		}
	}

	// Parse record if present
	if src.Record != "" {
		var record ngmodels.Record
		if err := json.Unmarshal([]byte(src.Record), &record); err != nil {
			return fmt.Errorf("failed to parse record: %w", err)
		}
		dst.Record = &record
	}

	// Set remaining simple fields
	dst.Condition = src.Condition
	dst.DashboardUID = src.DashboardUID
	dst.PanelID = src.PanelID
	dst.GUID = src.GUID

	// Parse states
	if src.NoDataState != "" {
		state, _ := ngmodels.NoDataStateFromString(src.NoDataState)
		dst.NoDataState = state
	}
	if src.ExecErrState != "" {
		state, _ := ngmodels.ErrStateFromString(src.ExecErrState)
		dst.ExecErrState = state
	}

	if src.UpdatedBy != nil {
		dst.UpdatedBy = util.Pointer(ngmodels.UserUID(*src.UpdatedBy))
	}

	dst.MissingSeriesEvalsToResolve = src.MissingSeriesEvalsToResolve

	return nil
}

// Helper functions to determine what needs to be parsed
func needsLabels(query *ngmodels.ListAlertRulesQuery) bool {
	return len(query.Labels) > 0 || query.ExcludePlugins
}

func needsNotificationSettings(query *ngmodels.ListAlertRulesQuery) bool {
	return query.ReceiverName != "" || query.TimeIntervalName != ""
}

func needsFullData(query *ngmodels.ListAlertRulesQuery) bool {
	return len(query.DatasourceUIDs) > 0
}

func matchesLabelFilters(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesQuery) bool {
	labels := rule.GetLabels()
	
	// Check exclude plugins
	if query.ExcludePlugins {
		if _, ok := labels["__grafana_origin"]; ok {
			return false
		}
	}

	// Check label filters
	for _, l := range query.Labels {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		if strings.Contains(l, "=") {
			parts := strings.SplitN(l, "=", 2)
			k := strings.TrimSpace(parts[0])
			v := strings.TrimSpace(parts[1])
			if labels[k] != v {
				return false
			}
		} else {
			if _, ok := labels[l]; !ok {
				return false
			}
		}
	}

	return true
}

func matchesNotificationFilters(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesQuery) bool {
	if query.ReceiverName != "" {
		if !slices.ContainsFunc(rule.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return settings.Receiver == query.ReceiverName
		}) {
			return false
		}
	}

	if query.TimeIntervalName != "" {
		if !slices.ContainsFunc(rule.NotificationSettings, func(settings ngmodels.NotificationSettings) bool {
			return slices.Contains(settings.MuteTimeIntervals, query.TimeIntervalName) ||
				slices.Contains(settings.ActiveTimeIntervals, query.TimeIntervalName)
		}) {
			return false
		}
	}

	return true
}

func matchesDataSourceFilters(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesQuery) bool {
	if len(query.DatasourceUIDs) == 0 {
		return true
	}

	uids := make(map[string]struct{})
	for _, u := range query.DatasourceUIDs {
		uids[u] = struct{}{}
	}

	for _, dq := range rule.Data {
		if dq.DatasourceUID != "" {
			if _, ok := uids[dq.DatasourceUID]; ok {
				return true
			}
		}
	}

	if rule.Record != nil && rule.Record.TargetDatasourceUID != "" {
		if _, ok := uids[rule.Record.TargetDatasourceUID]; ok {
			return true
		}
	}

	return false
}

func matchesTextFilters(rule *ngmodels.AlertRule, query *ngmodels.ListAlertRulesQuery) bool {
	// Free-form search
	if s := strings.TrimSpace(strings.ToLower(query.FreeFormSearch)); s != "" {
		if !strings.Contains(strings.ToLower(rule.Title), s) {
			return false
		}
	}
	
	// Rule name search
	if s := strings.TrimSpace(strings.ToLower(query.RuleNameSearch)); s != "" {
		if !strings.Contains(strings.ToLower(rule.Title), s) {
			return false
		}
	}
	
	// Group name search
	if s := strings.TrimSpace(strings.ToLower(query.GroupNameSearch)); s != "" {
		if !strings.Contains(strings.ToLower(rule.RuleGroup), s) {
			return false
		}
	}

	return true
}

// BatchStreamAlertRules processes rules in batches for better performance
func (st DBstore) BatchStreamAlertRules(ctx context.Context, query *ngmodels.ListAlertRulesQuery, batchSize int, batchProcessor func([]*ngmodels.AlertRule) error) error {
	batch := make([]*ngmodels.AlertRule, 0, batchSize)
	
	return st.StreamAlertRules(ctx, query, func(rule *ngmodels.AlertRule) bool {
		batch = append(batch, rule)
		
		if len(batch) >= batchSize {
			if err := batchProcessor(batch); err != nil {
				return false
			}
			batch = batch[:0] // Reset batch
		}
		
		return true
	})
}
