package models

import (
	"encoding/json"
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

// AlertRuleGen provides a factory function that generates a random AlertRule.
// The mutators arguments allows changing fields of the resulting structure
func AlertRuleGen(mutators ...func(*AlertRule)) func() *AlertRule {
	return func() *AlertRule {
		randNoDataState := func() NoDataState {
			s := [...]NoDataState{
				Alerting,
				NoData,
				OK,
			}
			return s[rand.Intn(len(s)-1)]
		}

		randErrState := func() ExecutionErrorState {
			s := [...]ExecutionErrorState{
				AlertingErrState,
				ErrorErrState,
				OkErrState,
			}
			return s[rand.Intn(len(s)-1)]
		}

		interval := (rand.Int63n(6) + 1) * 10
		forInterval := time.Duration(interval*rand.Int63n(6)) * time.Second

		var annotations map[string]string = nil
		if rand.Int63()%2 == 0 {
			qty := rand.Intn(5)
			annotations = make(map[string]string, qty)
			for i := 0; i < qty; i++ {
				annotations[util.GenerateShortUID()] = util.GenerateShortUID()
			}
		}
		var labels map[string]string = nil
		if rand.Int63()%2 == 0 {
			qty := rand.Intn(5)
			labels = make(map[string]string, qty)
			for i := 0; i < qty; i++ {
				labels[util.GenerateShortUID()] = util.GenerateShortUID()
			}
		}

		var dashUID *string = nil
		var panelID *int64 = nil
		if rand.Int63()%2 == 0 {
			d := util.GenerateShortUID()
			dashUID = &d
			p := rand.Int63()
			panelID = &p
		}

		rule := &AlertRule{
			ID:        rand.Int63(),
			OrgID:     rand.Int63(),
			Title:     "TEST-ALERT-" + util.GenerateShortUID(),
			Condition: "A",
			Data: []AlertQuery{
				{
					DatasourceUID: "-100",
					Model: json.RawMessage(`{
			"datasourceUid": "-100",
			"type":"math",
			"expression":"2 + 1 < 1"
		}`),
					RelativeTimeRange: RelativeTimeRange{
						From: Duration(5 * time.Hour),
						To:   Duration(3 * time.Hour),
					},
					RefID: "A",
				}},
			Updated:         time.Now().Add(-time.Duration(rand.Intn(100) + 1)),
			IntervalSeconds: rand.Int63n(60) + 1,
			Version:         rand.Int63(),
			UID:             util.GenerateShortUID(),
			NamespaceUID:    util.GenerateShortUID(),
			DashboardUID:    dashUID,
			PanelID:         panelID,
			RuleGroup:       "TEST-GROUP-" + util.GenerateShortUID(),
			NoDataState:     randNoDataState(),
			ExecErrState:    randErrState(),
			For:             forInterval,
			Annotations:     annotations,
			Labels:          labels,
		}

		for _, mutator := range mutators {
			mutator(rule)
		}
		return rule
	}
}

// GenerateUniqueAlertRules generates many random alert rules and makes sure that they have unique UID.
// It returns a tuple where first element is a map where keys are UID of alert rule and the second element is a slice of the same rules
func GenerateUniqueAlertRules(count int, f func() *AlertRule) (map[string]*AlertRule, []*AlertRule) {
	uIDs := make(map[string]*AlertRule, count)
	result := make([]*AlertRule, 0, count)
	for len(result) < count {
		rule := f()
		if _, ok := uIDs[rule.UID]; ok {
			continue
		}
		result = append(result, rule)
		uIDs[rule.UID] = rule
	}
	return uIDs, result
}

// GenerateAlertRules generates many random alert rules. Does not guarantee that rules are unique (by UID)
func GenerateAlertRules(count int, f func() *AlertRule) []*AlertRule {
	result := make([]*AlertRule, 0, count)
	for len(result) < count {
		rule := f()
		result = append(result, rule)
	}
	return result
}
