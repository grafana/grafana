package ualert

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/tsdb/graphite"
)

var (
	hasPlaceholdersRe = regexp.MustCompile(`#([A-Za-z]+)`)
)

var (
	failedGraphiteMigrations             int64
	successfulGraphiteMigrationCopy      int64
	successfulGraphiteMigrationDashboard int64
)

type panel struct {
	ID      int64    `json:"id"`
	Targets []target `json:"targets"`
	Panels  []panel  `json:"panels"`
}

type target struct {
	RefID  string `json:"refId"`
	Target string `json:"target"`
}

// fixGraphiteReferencedSubQueries attempts to fix graphite referenced sub queries, given unified alerting does not support this.
// targetFull of Graphite data source contains the expanded version of field 'target', so let's copy that.
func fixGraphiteReferencedSubQueries(l log.Logger, queryData map[string]json.RawMessage, ruleID, panelID int64, dashboard *dashboards.Dashboard) map[string]json.RawMessage {
	if !isFixable(l, queryData) {
		return queryData
	}
	fullQuery, ok := queryData[graphite.TargetFullModelField]
	// We also need to check for placeholders here, as the data can be very old and suffer from a bug that only
	// the first placeholder of the same name got replaced.
	if ok && !hasPlaceholders(string(fullQuery)) {
		successfulGraphiteMigrationCopy++
		delete(queryData, graphite.TargetFullModelField)
		queryData[graphite.TargetModelField] = fullQuery
		return queryData
	}

	// Sometimes it can happen that the "targetFull" field is not there. In this case we can
	// extract this information from the panel of the dashboard.
	fullQueryRaw, err := unwrapFromDashboard(l, queryData, panelID, dashboard)
	if err != nil {
		failedGraphiteMigrations++
		l.Error("graphite query migration: failed to unwrap query from dashboard", "err", err, "rule_id", ruleID)
		return queryData
	}
	b, err := json.Marshal(fullQueryRaw)
	if err != nil {
		failedGraphiteMigrations++
		l.Error("graphite query migration: failed to marshal the unwrapped query", "query", fullQueryRaw, "err", err, "rule_id", ruleID)
		return queryData
	}
	successfulGraphiteMigrationDashboard++
	l.Debug("graphite query migration: successfully unwrapped query using the dashboard", "query", fullQueryRaw, "rule_id", ruleID)
	queryData[graphite.TargetModelField] = b

	return queryData
}

func isFixable(l log.Logger, queryData map[string]json.RawMessage) bool {
	_, ok := queryData[graphite.TargetFullModelField]
	if ok {
		return true
	}
	// Check if the target field has any placeholders.
	targetRaw, ok := queryData[graphite.TargetModelField]
	if !ok {
		l.Error("query data does not have field 'target'")
		return false
	}
	var target string
	err := json.Unmarshal(targetRaw, &target)
	if err != nil {
		l.Error("failed to unmarshal target", "err", err)
		return false
	}
	if !hasPlaceholders(target) {
		return false
	}
	return true
}

func unwrapFromDashboard(l log.Logger, queryData map[string]json.RawMessage, panelID int64, dashboard *dashboards.Dashboard) (string, error) {
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
	return unwrapFromPanel(l, panels, panelID, refID, 0)
}

var (
	errPanelNotFound = errors.New("panel not found")
)

func unwrapFromPanel(l log.Logger, panels []panel, panelID int64, refID string, parent int64) (string, error) {
	for _, panel := range panels {
		if panel.ID == panelID {
			return unwrapTarget(refID, panel.Targets)
		}
		if len(panel.Panels) > 0 {
			unwrappedTarget, err := unwrapFromPanel(l, panel.Panels, panelID, refID, panel.ID)
			if err == nil {
				return unwrappedTarget, nil
			}
			if !errors.Is(err, errPanelNotFound) {
				return "", err
			}
		}
	}
	return "", errPanelNotFound
}

func unwrapTarget(refID string, targets []target) (string, error) {
	m := make(map[string]string)
	visited := make(map[string]bool)

	// Populate the map with the target strings.
	for _, t := range targets {
		m[t.RefID] = t.Target
	}

	_, ok := m[refID]
	if !ok {
		return "", fmt.Errorf("refID %s not found in targets", refID)
	}

	// Check for circular dependencies by keeping track of visited refIDs.
	// The detection of circular dependencies happens by marking a refID as visited
	// before we start its replacement process, and unmarking it after we're done.
	// This way, if we encounter the same refID during its own replacement process,
	// we know it's a circular dependency.
	var unwrap func(string) (string, error)
	unwrap = func(currentRefID string) (string, error) {
		if visited[currentRefID] {
			return "", fmt.Errorf("circular dependency on refID %s", currentRefID)
		}

		visited[currentRefID] = true
		defer func() { visited[currentRefID] = false }()

		currentResult, ok := m[currentRefID]
		if !ok {
			return "", fmt.Errorf("refID %s not found in targets", currentRefID)
		}

		matches := hasPlaceholdersRe.FindAllStringSubmatch(currentResult, -1)
		for _, match := range matches {
			placeholderRef := match[1]
			replacement, err := unwrap(placeholderRef)
			if err != nil {
				return "", err
			}
			currentResult = strings.ReplaceAll(currentResult, "#"+placeholderRef, replacement)
		}

		return currentResult, nil
	}

	return unwrap(refID)
}

func hasPlaceholders(s string) bool {
	// Use the regular expression to match the string
	return hasPlaceholdersRe.MatchString(s)
}

func logGraphiteMigrationStats(l log.Logger) {
	if successfulGraphiteMigrationDashboard == 0 && successfulGraphiteMigrationCopy == 0 && failedGraphiteMigrations == 0 {
		return
	}
	l.Info("Graphite rules migration stats",
		"failed", failedGraphiteMigrations,
		"success_copy", successfulGraphiteMigrationCopy,
		"success_dashboard", successfulGraphiteMigrationDashboard)
}
