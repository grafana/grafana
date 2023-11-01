package migration

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
)

var (
	hasPlaceholdersRe = regexp.MustCompile(`#([A-Za-z]+)`)
)

type panel struct {
	ID      int64    `json:"id"`
	Targets []target `json:"targets"`
}

type target struct {
	RefID  string `json:"refId"`
	Target string `json:"target"`
}

// fixGraphiteReferencedSubQueries attempts to fix graphite referenced sub queries, given unified alerting does not support this.
// targetFull of Graphite data source contains the expanded version of field 'target', so let's copy that.
func fixGraphiteReferencedSubQueries(l log.Logger, queryData map[string]json.RawMessage, panelID int64, dashboard *dashboards.Dashboard) map[string]json.RawMessage {
	if !isFixable(l, queryData) {
		return queryData
	}
	fullQuery, ok := queryData[graphite.TargetFullModelField]
	if ok {
		delete(queryData, graphite.TargetFullModelField)
		queryData[graphite.TargetModelField] = fullQuery
	} else {
		// Sometimes it can happen that the "targetFull" field is not there. In this case we can
		// extract this information from the panel of the dashboard.
		fullQueryRaw, err := unwrapFromDashboard(queryData, panelID, dashboard)
		if err != nil {
			l.Error("graphite query migration: failed to unwrap query from dashboard", "err", err)
			return queryData
		}
		b, err := json.Marshal(fullQueryRaw)
		if err != nil {
			l.Error("graphite query migration: failed to marshal the unwrapped query", "query", fullQueryRaw, "err", err)
			return queryData
		}
		l.Info("graphite query migration: successfully unwrapped query using the dashboard", "query", fullQueryRaw)
		queryData[graphite.TargetModelField] = b
	}
	return queryData
}

func isFixable(l log.Logger, queryData map[string]json.RawMessage) bool {
	// Check if it's a graphite Query.
	ok, err := isGraphiteQuery(queryData)
	if err != nil || !ok {
		return false
	}
	// Check if the target field has any placeholders.
	targetRaw, ok := queryData[graphite.TargetModelField]
	if !ok {
		l.Error("query data does not have field 'target'")
		return false
	}
	var target string
	err = json.Unmarshal(targetRaw, &target)
	if err != nil {
		l.Error("failed to unmarshal target", "err", err)
		return false
	}
	if !hasPlaceholders(target) {
		return false
	}
	return true
}

func unwrapFromDashboard(queryData map[string]json.RawMessage, panelID int64, dashboard *dashboards.Dashboard) (string, error) {
	refIDRaw, ok := queryData["refId"]
	if !ok {
		return "", fmt.Errorf("query data does not have field 'refId'")
	}
	var refID string
	err := json.Unmarshal(refIDRaw, &refID)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal refId: %w", err)
	}
	panelsRaw := dashboard.Data.Get("panels")
	// Simplejson doesn't let you unmarshal in a type, so we need to work around this.
	b, err := panelsRaw.MarshalJSON()
	if err != nil {
		return "", fmt.Errorf("failed to marshal panels: %w", err)
	}
	var panels []panel
	err = json.Unmarshal(b, &panels)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal panels: %w", err)
	}
	for _, panel := range panels {
		if panel.ID == panelID {
			return unwrapTarget(refID, panel.Targets), nil
		}
	}
	return "", fmt.Errorf("failed to find panel with id %d", panelID)
}

func unwrapTarget(refID string, targets []target) string {
	m := make(map[string]string)
	for _, t := range targets {
		m[t.RefID] = t.Target
	}
	result := m[refID]

	for {
		matches := hasPlaceholdersRe.FindStringSubmatch(result)
		if len(matches) == 0 {
			break
		}
		ref := matches[1]
		result = strings.ReplaceAll(result, "#"+ref, m[ref])
	}
	return result
}

func isGraphiteQuery(queryData map[string]json.RawMessage) (bool, error) {
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
	return datasource.Type == datasources.DS_GRAPHITE, nil
}

func hasPlaceholders(s string) bool {
	// Use the regular expression to match the string
	return hasPlaceholdersRe.MatchString(s)
}
