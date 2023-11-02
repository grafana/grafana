package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	migmodels "github.com/grafana/grafana/pkg/services/ngalert/migration/models"
	migrationStore "github.com/grafana/grafana/pkg/services/ngalert/migration/store"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
	"github.com/grafana/grafana/pkg/util"
)

const (
	// ContactLabel is a private label created during migration and used in notification policies.
	// It stores a string array of all contact point names an alert rule should send to.
	// It was created as a means to simplify post-migration notification policies.
	ContactLabel = "__contacts__"
)

func addMigrationInfo(da *migrationStore.DashAlert, dashboardUID string) (map[string]string, map[string]string) {
	tagsMap := simplejson.NewFromAny(da.ParsedSettings.AlertRuleTags).MustMap()
	lbls := make(map[string]string, len(tagsMap))

	for k, v := range tagsMap {
		lbls[k] = simplejson.NewFromAny(v).MustString()
	}

	annotations := make(map[string]string, 3)
	annotations[ngmodels.DashboardUIDAnnotation] = dashboardUID
	annotations[ngmodels.PanelIDAnnotation] = fmt.Sprintf("%v", da.PanelID)
	annotations["__alertId__"] = fmt.Sprintf("%v", da.ID)

	return lbls, annotations
}

// MigrateAlert migrates a single dashboard alert from legacy alerting to unified alerting.
func (om *OrgMigration) migrateAlert(ctx context.Context, l log.Logger, da *migrationStore.DashAlert, info migmodels.DashboardUpgradeInfo) (*ngmodels.AlertRule, error) {
	l.Debug("Migrating alert rule to Unified Alerting")
	cond, err := transConditions(ctx, da, om.migrationStore)
	if err != nil {
		return nil, fmt.Errorf("transform conditions: %w", err)
	}

	lbls, annotations := addMigrationInfo(da, info.DashboardUID)

	message := MigrateTmpl(l.New("field", "message"), da.Message)
	annotations["message"] = message

	data, err := migrateAlertRuleQueries(l, cond.Data)
	if err != nil {
		return nil, fmt.Errorf("failed to migrate alert rule queries: %w", err)
	}

	isPaused := false
	if da.State == "paused" {
		isPaused = true
	}

	// Here we ensure that the alert rule title is unique within the folder.
	titleDedupSet := om.AlertTitleDeduplicator(info.NewFolderUID)
	name := truncate(da.Name, store.AlertDefinitionMaxTitleLength)
	if titleDedupSet.contains(name) {
		dedupedName := titleDedupSet.deduplicate(name)
		l.Debug("Duplicate alert rule name detected, renaming", "oldName", name, "newName", dedupedName)
		name = dedupedName
	}
	titleDedupSet.add(name)

	// Here we ensure that the alert rule group is unique within the folder.
	// This is so that we don't have to ensure that the alerts rules have the same interval.
	groupDedupSet := om.AlertTitleDeduplicator(info.NewFolderUID)
	panelSuffix := fmt.Sprintf(" - %d", da.PanelID)
	truncatedDashboard := truncate(info.DashboardName, store.AlertRuleMaxRuleGroupNameLength-len(panelSuffix))
	groupName := fmt.Sprintf("%s%s", truncatedDashboard, panelSuffix) // Unique to this dash alert but still contains useful info.
	if groupDedupSet.contains(groupName) {
		dedupedGroupName := groupDedupSet.deduplicate(groupName)
		l.Debug("Duplicate alert rule group name detected, renaming", "oldGroup", groupName, "newGroup", dedupedGroupName)
		groupName = dedupedGroupName
	}
	groupDedupSet.add(groupName)

	dashUID := info.DashboardUID
	ar := &ngmodels.AlertRule{
		OrgID:           da.OrgID,
		Title:           name,
		UID:             util.GenerateShortUID(),
		Condition:       cond.Condition,
		Data:            data,
		IntervalSeconds: ruleAdjustInterval(da.Frequency),
		Version:         1,
		NamespaceUID:    info.NewFolderUID,
		DashboardUID:    &dashUID,
		PanelID:         &da.PanelID,
		RuleGroup:       groupName,
		For:             da.For,
		Updated:         time.Now().UTC(),
		Annotations:     annotations,
		Labels:          lbls,
		RuleGroupIndex:  1, // Every rule is in its own group.
		IsPaused:        isPaused,
		NoDataState:     transNoData(l, da.ParsedSettings.NoDataState),
		ExecErrState:    transExecErr(l, da.ParsedSettings.ExecutionErrorState),
	}

	// Label for routing and silences.
	n, v := getLabelForSilenceMatching(ar.UID)
	ar.Labels[n] = v

	if da.ParsedSettings.ExecutionErrorState == string(legacymodels.ExecutionErrorKeepState) {
		if err := om.addErrorSilence(ar); err != nil {
			om.log.Error("Alert migration error: failed to create silence for Error", "rule_name", ar.Title, "err", err)
		}
	}

	if da.ParsedSettings.NoDataState == string(legacymodels.NoDataKeepState) {
		if err := om.addNoDataSilence(ar); err != nil {
			om.log.Error("Alert migration error: failed to create silence for NoData", "rule_name", ar.Title, "err", err)
		}
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
		return false, fmt.Errorf("failed to parse datasource '%s': %w", string(ds), err)
	}
	if datasource.Type == "" {
		return false, fmt.Errorf("missing type field '%s'", string(ds))
	}
	return datasource.Type == "prometheus", nil
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
		return ngmodels.NoData // "keep last state" translates to no data because we now emit a special alert when the state is "noData". The result is that the evaluation will not return firing and instead we'll raise the special alert.
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
		// Keep last state is translated to error as we now emit a
		// DatasourceError alert when the state is error
		return ngmodels.ErrorErrState
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

func extractChannelIDs(d *migrationStore.DashAlert) (channelUids []migrationStore.UidOrID) {
	// Extracting channel UID/ID.
	for _, ui := range d.ParsedSettings.Notifications {
		if ui.UID != "" {
			channelUids = append(channelUids, ui.UID)
			continue
		}
		// In certain circumstances, id is used instead of uid.
		// We add this if there was no uid.
		if ui.ID > 0 {
			channelUids = append(channelUids, ui.ID)
		}
	}

	return channelUids
}
