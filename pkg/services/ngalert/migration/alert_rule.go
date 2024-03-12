package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/util"
)

func addLabelsAndAnnotations(l log.Logger, alert *legacymodels.Alert, dashboardUID string) (data.Labels, data.Labels) {
	tags := alert.GetTagsFromSettings()
	lbls := make(data.Labels, len(tags)+1)

	for _, t := range tags {
		lbls[t.Key] = t.Value
	}

	// Add a label for routing
	lbls[ngmodels.MigratedUseLegacyChannelsLabel] = "true"

	annotations := make(data.Labels, 4)
	annotations[ngmodels.DashboardUIDAnnotation] = dashboardUID
	annotations[ngmodels.PanelIDAnnotation] = fmt.Sprintf("%v", alert.PanelID)
	annotations[ngmodels.MigratedAlertIdAnnotation] = fmt.Sprintf("%v", alert.ID)

	message := MigrateTmpl(l.New("field", "message"), alert.Message)
	annotations[ngmodels.MigratedMessageAnnotation] = message

	return lbls, annotations
}

// migrateAlert migrates a single dashboard alert from legacy alerting to unified alerting.
func (om *OrgMigration) migrateAlert(ctx context.Context, l log.Logger, alert *legacymodels.Alert, dashboard *dashboards.Dashboard) (*ngmodels.AlertRule, error) {
	l.Debug("Migrating alert rule to Unified Alerting")
	rawSettings, err := json.Marshal(alert.Settings)
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	var parsedSettings dashAlertSettings
	err = json.Unmarshal(rawSettings, &parsedSettings)
	if err != nil {
		return nil, fmt.Errorf("parse settings: %w", err)
	}
	cond, err := transConditions(ctx, l, parsedSettings, alert.OrgID, om.migrationStore)
	if err != nil {
		return nil, fmt.Errorf("transform conditions: %w", err)
	}

	lbls, annotations := addLabelsAndAnnotations(l, alert, dashboard.UID)

	data, err := migrateAlertRuleQueries(l, cond.Data)
	if err != nil {
		return nil, fmt.Errorf("queries: %w", err)
	}

	isPaused := false
	if alert.State == "paused" {
		isPaused = true
	}

	dashUID := dashboard.UID
	ar := &ngmodels.AlertRule{
		OrgID:           alert.OrgID,
		Title:           alert.Name, // Title will be deduplicated on persist.
		UID:             util.GenerateShortUID(),
		Condition:       cond.Condition,
		Data:            data,
		IntervalSeconds: ruleAdjustInterval(alert.Frequency),
		Version:         1,
		NamespaceUID:    "", // The folder for this alert is determined later.
		DashboardUID:    &dashUID,
		PanelID:         &alert.PanelID,
		RuleGroup:       groupName(ruleAdjustInterval(alert.Frequency), dashboard.Title),
		For:             alert.For,
		Updated:         time.Now().UTC(),
		Annotations:     annotations,
		Labels:          lbls,
		RuleGroupIndex:  1, // Every rule is in its own group.
		IsPaused:        isPaused,
		NoDataState:     transNoData(l, parsedSettings.NoDataState),
		ExecErrState:    transExecErr(l, parsedSettings.ExecutionErrorState),
	}

	om.silences.handleSilenceLabels(ar, parsedSettings)

	// We do some validation and pre-save operations early in order to track these errors as part of the migration state.
	if err := ar.ValidateAlertRule(om.cfg.UnifiedAlerting); err != nil {
		return nil, err
	}
	if err := ar.PreSave(time.Now); err != nil {
		return nil, err
	}

	return ar, nil
}

// migrateAlertRuleQueries attempts to fix alert rule queries so they can work in unified alerting. Queries of some data sources are not compatible with unified alerting.
func migrateAlertRuleQueries(l log.Logger, data []ngmodels.AlertQuery) ([]ngmodels.AlertQuery, error) {
	result := make([]ngmodels.AlertQuery, 0, len(data))
	for _, d := range data {
		// queries that are expression are not relevant, skip them.
		if d.DatasourceUID == expressionDatasourceUID {
			result = append(result, d)
			continue
		}
		var fixedData map[string]json.RawMessage
		err := json.Unmarshal(d.Model, &fixedData)
		if err != nil {
			return nil, err
		}
		// remove hidden tag from the query (if exists)
		delete(fixedData, "hide")
		fixedData = fixGraphiteReferencedSubQueries(fixedData)
		fixedData = fixPrometheusBothTypeQuery(l, fixedData)
		updatedModel, err := json.Marshal(fixedData)
		if err != nil {
			return nil, err
		}
		d.Model = updatedModel
		result = append(result, d)
	}
	return result, nil
}

// fixGraphiteReferencedSubQueries attempts to fix graphite referenced sub queries, given unified alerting does not support this.
// targetFull of Graphite data source contains the expanded version of field 'target', so let's copy that.
func fixGraphiteReferencedSubQueries(queryData map[string]json.RawMessage) map[string]json.RawMessage {
	fullQuery, ok := queryData[graphite.TargetFullModelField]
	if ok {
		delete(queryData, graphite.TargetFullModelField)
		queryData[graphite.TargetModelField] = fullQuery
	}

	return queryData
}

// fixPrometheusBothTypeQuery converts Prometheus 'Both' type queries to range queries.
func fixPrometheusBothTypeQuery(l log.Logger, queryData map[string]json.RawMessage) map[string]json.RawMessage {
	// There is the possibility to support this functionality by:
	//	- Splitting the query into two: one for instant and one for range.
	//  - Splitting the condition into two: one for each query, separated by OR.
	// However, relying on a 'Both' query instead of multiple conditions to do this in legacy is likely
	// to be unintentional. In addition, this would require more robust operator precedence in classic conditions.
	// Given these reasons, we opt to convert them to range queries and log a warning.

	var instant bool
	if instantRaw, ok := queryData["instant"]; ok {
		if err := json.Unmarshal(instantRaw, &instant); err != nil {
			// Nothing to do here, we can't parse the instant field.
			if isPrometheus, _ := isPrometheusQuery(queryData); isPrometheus {
				l.Info("Failed to parse instant field on Prometheus query", "instant", string(instantRaw), "err", err)
			}
			return queryData
		}
	}
	var rng bool
	if rangeRaw, ok := queryData["range"]; ok {
		if err := json.Unmarshal(rangeRaw, &rng); err != nil {
			// Nothing to do here, we can't parse the range field.
			if isPrometheus, _ := isPrometheusQuery(queryData); isPrometheus {
				l.Info("Failed to parse range field on Prometheus query", "range", string(rangeRaw), "err", err)
			}
			return queryData
		}
	}

	if !instant || !rng {
		// Only apply this fix to 'Both' type queries.
		return queryData
	}

	isPrometheus, err := isPrometheusQuery(queryData)
	if err != nil {
		l.Info("Unable to convert alert rule that resembles a Prometheus 'Both' type query to 'Range'", "err", err)
		return queryData
	}
	if !isPrometheus {
		// Only apply this fix to Prometheus.
		return queryData
	}

	// Convert 'Both' type queries to `Range` queries by disabling the `Instant` portion.
	l.Warn("Prometheus 'Both' type queries are not supported in unified alerting. Converting to range query.")
	queryData["instant"] = []byte("false")

	return queryData
}

// isPrometheusQuery checks if the query is for Prometheus.
func isPrometheusQuery(queryData map[string]json.RawMessage) (bool, error) {
	ds, ok := queryData["datasource"]
	if !ok {
		return false, fmt.Errorf("missing datasource field")
	}
	var datasource struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(ds, &datasource); err != nil {
		return false, fmt.Errorf("parse datasource '%s': %w", string(ds), err)
	}
	if datasource.Type == "" {
		return false, fmt.Errorf("missing type field '%s'", string(ds))
	}
	return datasource.Type == datasources.DS_PROMETHEUS, nil
}

func ruleAdjustInterval(freq int64) int64 {
	// 10 corresponds to the SchedulerCfg, but TODO not worrying about fetching for now.
	var baseFreq int64 = 10
	if freq <= baseFreq {
		return 10
	}
	return freq - (freq % baseFreq)
}

func transNoData(l log.Logger, s string) ngmodels.NoDataState {
	switch legacymodels.NoDataOption(s) {
	case legacymodels.NoDataSetOK:
		return ngmodels.OK // values from ngalert/models/rule
	case "", legacymodels.NoDataSetNoData:
		return ngmodels.NoData
	case legacymodels.NoDataSetAlerting:
		return ngmodels.Alerting
	case legacymodels.NoDataKeepState:
		return ngmodels.KeepLast
	default:
		l.Warn("Unable to translate execution of NoData state. Using default execution", "old", s, "new", ngmodels.NoData)
		return ngmodels.NoData
	}
}

func transExecErr(l log.Logger, s string) ngmodels.ExecutionErrorState {
	switch legacymodels.ExecutionErrorOption(s) {
	case "", legacymodels.ExecutionErrorSetAlerting:
		return ngmodels.AlertingErrState
	case legacymodels.ExecutionErrorKeepState:
		return ngmodels.KeepLastErrState
	case legacymodels.ExecutionErrorSetOk:
		return ngmodels.OkErrState
	default:
		l.Warn("Unable to translate execution of Error state. Using default execution", "old", s, "new", ngmodels.ErrorErrState)
		return ngmodels.ErrorErrState
	}
}

// truncate truncates the given name to the maximum allowed length.
func truncate(daName string, length int) string {
	if len(daName) > length {
		return daName[:length]
	}
	return daName
}

// groupName constructs a group name from the dashboard title and the interval. It truncates the dashboard title
// if necessary to ensure that the group name is not longer than the maximum allowed length.
func groupName(interval int64, dashboardTitle string) string {
	duration := model.Duration(time.Duration(interval) * time.Second) // Humanize.
	panelSuffix := fmt.Sprintf(" - %s", duration.String())
	truncatedDashboard := truncate(dashboardTitle, store.AlertRuleMaxRuleGroupNameLength-len(panelSuffix))
	return fmt.Sprintf("%s%s", truncatedDashboard, panelSuffix)
}
