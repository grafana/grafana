package api

import (
	"encoding/json"
	"time"

	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AlertRuleFromProvisionedAlertRule converts definitions.ProvisionedAlertRule to models.AlertRule
func AlertRuleFromProvisionedAlertRule(a definitions.ProvisionedAlertRule) (models.AlertRule, error) {
	return models.AlertRule{
		ID:           a.ID,
		UID:          a.UID,
		OrgID:        a.OrgID,
		NamespaceUID: a.FolderUID,
		RuleGroup:    a.RuleGroup,
		Title:        a.Title,
		Condition:    a.Condition,
		Data:         AlertQueriesFromApiAlertQueries(a.Data),
		Updated:      a.Updated,
		NoDataState:  models.NoDataState(a.NoDataState),          // TODO there must be a validation
		ExecErrState: models.ExecutionErrorState(a.ExecErrState), // TODO there must be a validation
		For:          time.Duration(a.For),
		Annotations:  a.Annotations,
		Labels:       a.Labels,
		IsPaused:     a.IsPaused,
	}, nil
}

// ProvisionedAlertRuleFromAlertRule converts models.AlertRule to definitions.ProvisionedAlertRule and sets provided provenance status
func ProvisionedAlertRuleFromAlertRule(rule models.AlertRule, provenance models.Provenance) definitions.ProvisionedAlertRule {
	return definitions.ProvisionedAlertRule{
		ID:           rule.ID,
		UID:          rule.UID,
		OrgID:        rule.OrgID,
		FolderUID:    rule.NamespaceUID,
		RuleGroup:    rule.RuleGroup,
		Title:        rule.Title,
		For:          model.Duration(rule.For),
		Condition:    rule.Condition,
		Data:         ApiAlertQueriesFromAlertQueries(rule.Data),
		Updated:      rule.Updated,
		NoDataState:  definitions.NoDataState(rule.NoDataState),          // TODO there may be a validation
		ExecErrState: definitions.ExecutionErrorState(rule.ExecErrState), // TODO there may be a validation
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		Provenance:   definitions.Provenance(provenance), // TODO validate enum conversion?
		IsPaused:     rule.IsPaused,
	}
}

// ProvisionedAlertRuleFromAlertRules converts a collection of models.AlertRule to definitions.ProvisionedAlertRules with provenance status models.ProvenanceNone
func ProvisionedAlertRuleFromAlertRules(rules []*models.AlertRule) definitions.ProvisionedAlertRules {
	result := make([]definitions.ProvisionedAlertRule, 0, len(rules))
	for _, r := range rules {
		result = append(result, ProvisionedAlertRuleFromAlertRule(*r, models.ProvenanceNone))
	}
	return result
}

// AlertQueriesFromApiAlertQueries converts a collection of definitions.AlertQuery to collection of models.AlertQuery
func AlertQueriesFromApiAlertQueries(queries []definitions.AlertQuery) []models.AlertQuery {
	result := make([]models.AlertQuery, 0, len(queries))
	for _, q := range queries {
		result = append(result, models.AlertQuery{
			RefID:     q.RefID,
			QueryType: q.QueryType,
			RelativeTimeRange: models.RelativeTimeRange{
				From: models.Duration(q.RelativeTimeRange.From),
				To:   models.Duration(q.RelativeTimeRange.To),
			},
			DatasourceUID: q.DatasourceUID,
			Model:         q.Model,
		})
	}
	return result
}

// ApiAlertQueriesFromAlertQueries converts a collection of models.AlertQuery to collection of definitions.AlertQuery
func ApiAlertQueriesFromAlertQueries(queries []models.AlertQuery) []definitions.AlertQuery {
	result := make([]definitions.AlertQuery, 0, len(queries))
	for _, q := range queries {
		result = append(result, definitions.AlertQuery{
			RefID:     q.RefID,
			QueryType: q.QueryType,
			RelativeTimeRange: definitions.RelativeTimeRange{
				From: definitions.Duration(q.RelativeTimeRange.From),
				To:   definitions.Duration(q.RelativeTimeRange.To),
			},
			DatasourceUID: q.DatasourceUID,
			Model:         q.Model,
		})
	}
	return result
}

func AlertRuleGroupFromApiAlertRuleGroup(a definitions.AlertRuleGroup) (models.AlertRuleGroup, error) {
	ruleGroup := models.AlertRuleGroup{
		Title:     a.Title,
		FolderUID: a.FolderUID,
		Interval:  a.Interval,
	}
	for i := range a.Rules {
		converted, err := AlertRuleFromProvisionedAlertRule(a.Rules[i])
		if err != nil {
			return models.AlertRuleGroup{}, err
		}
		ruleGroup.Rules = append(ruleGroup.Rules, converted)
	}
	return ruleGroup, nil
}

func ApiAlertRuleGroupFromAlertRuleGroup(d models.AlertRuleGroup) definitions.AlertRuleGroup {
	rules := make([]definitions.ProvisionedAlertRule, 0, len(d.Rules))
	for i := range d.Rules {
		rules = append(rules, ProvisionedAlertRuleFromAlertRule(d.Rules[i], d.Provenance))
	}
	return definitions.AlertRuleGroup{
		Title:     d.Title,
		FolderUID: d.FolderUID,
		Interval:  d.Interval,
		Rules:     rules,
	}
}

// AlertingFileExportFromAlertRuleGroupWithFolderTitle creates an definitions.AlertingFileExport DTO from []models.AlertRuleGroupWithFolderTitle.
func AlertingFileExportFromAlertRuleGroupWithFolderTitle(groups []models.AlertRuleGroupWithFolderTitle) (definitions.AlertingFileExport, error) {
	f := definitions.AlertingFileExport{APIVersion: 1}
	for _, group := range groups {
		export, err := AlertRuleGroupExportFromAlertRuleGroupWithFolderTitle(group)
		if err != nil {
			return definitions.AlertingFileExport{}, err
		}
		f.Groups = append(f.Groups, export)
	}
	return f, nil
}

// AlertRuleGroupExportFromAlertRuleGroupWithFolderTitle creates a definitions.AlertRuleGroupExport DTO from models.AlertRuleGroup.
func AlertRuleGroupExportFromAlertRuleGroupWithFolderTitle(d models.AlertRuleGroupWithFolderTitle) (definitions.AlertRuleGroupExport, error) {
	rules := make([]definitions.AlertRuleExport, 0, len(d.Rules))
	for i := range d.Rules {
		alert, err := AlertRuleExportFromAlertRule(d.Rules[i])
		if err != nil {
			return definitions.AlertRuleGroupExport{}, err
		}
		rules = append(rules, alert)
	}
	return definitions.AlertRuleGroupExport{
		OrgID:    d.OrgID,
		Name:     d.Title,
		Folder:   d.FolderTitle,
		Interval: model.Duration(time.Duration(d.Interval) * time.Second),
		Rules:    rules,
	}, nil
}

// AlertRuleExportFromAlertRule creates a definitions.AlertRuleExport DTO from models.AlertRule.
func AlertRuleExportFromAlertRule(rule models.AlertRule) (definitions.AlertRuleExport, error) {
	data := make([]definitions.AlertQueryExport, 0, len(rule.Data))
	for i := range rule.Data {
		query, err := AlertQueryExportFromAlertQuery(rule.Data[i])
		if err != nil {
			return definitions.AlertRuleExport{}, err
		}
		data = append(data, query)
	}

	var dashboardUID string
	if rule.DashboardUID != nil {
		dashboardUID = *rule.DashboardUID
	}

	var panelID int64
	if rule.PanelID != nil {
		panelID = *rule.PanelID
	}

	return definitions.AlertRuleExport{
		UID:          rule.UID,
		Title:        rule.Title,
		For:          model.Duration(rule.For),
		Condition:    rule.Condition,
		Data:         data,
		DashboardUID: dashboardUID,
		PanelID:      panelID,
		NoDataState:  definitions.NoDataState(rule.NoDataState),
		ExecErrState: definitions.ExecutionErrorState(rule.ExecErrState),
		Annotations:  rule.Annotations,
		Labels:       rule.Labels,
		IsPaused:     rule.IsPaused,
	}, nil
}

// AlertQueryExportFromAlertQuery creates a definitions.AlertQueryExport DTO from models.AlertQuery.
func AlertQueryExportFromAlertQuery(query models.AlertQuery) (definitions.AlertQueryExport, error) {
	// We unmarshal the json.RawMessage model into a map in order to facilitate yaml marshalling.
	var mdl map[string]interface{}
	err := json.Unmarshal(query.Model, &mdl)
	if err != nil {
		return definitions.AlertQueryExport{}, err
	}
	return definitions.AlertQueryExport{
		RefID:     query.RefID,
		QueryType: query.QueryType,
		RelativeTimeRange: definitions.RelativeTimeRange{
			From: definitions.Duration(query.RelativeTimeRange.From),
			To:   definitions.Duration(query.RelativeTimeRange.To),
		},
		DatasourceUID: query.DatasourceUID,
		Model:         mdl,
	}, nil
}
