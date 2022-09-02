package models

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	models2 "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleMutator func(*AlertRule)

// AlertRuleGen provides a factory function that generates a random AlertRule.
// The mutators arguments allows changing fields of the resulting structure
func AlertRuleGen(mutators ...AlertRuleMutator) func() *AlertRule {
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
			annotations = GenerateAlertLabels(rand.Intn(5), "ann-")
		}
		var labels map[string]string = nil
		if rand.Int63()%2 == 0 {
			labels = GenerateAlertLabels(rand.Intn(5), "lbl-")
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
			ID:              rand.Int63(),
			OrgID:           rand.Int63(),
			Title:           "TEST-ALERT-" + util.GenerateShortUID(),
			Condition:       "A",
			Data:            []AlertQuery{GenerateAlertQuery()},
			Updated:         time.Now().Add(-time.Duration(rand.Intn(100) + 1)),
			IntervalSeconds: rand.Int63n(60) + 1,
			Version:         rand.Int63(),
			UID:             util.GenerateShortUID(),
			NamespaceUID:    util.GenerateShortUID(),
			DashboardUID:    dashUID,
			PanelID:         panelID,
			RuleGroup:       "TEST-GROUP-" + util.GenerateShortUID(),
			RuleGroupIndex:  rand.Int(),
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

func WithNotEmptyLabels(count int, prefix string) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.Labels = GenerateAlertLabels(count, prefix)
	}
}
func WithUniqueID() AlertRuleMutator {
	usedID := make(map[int64]struct{})
	return func(rule *AlertRule) {
		for {
			id := rand.Int63()
			if _, ok := usedID[id]; !ok {
				usedID[id] = struct{}{}
				rule.ID = id
				return
			}
		}
	}
}

func WithGroupIndex(groupIndex int) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.RuleGroupIndex = groupIndex
	}
}

func WithUniqueGroupIndex() AlertRuleMutator {
	usedIdx := make(map[int]struct{})
	return func(rule *AlertRule) {
		for {
			idx := rand.Int()
			if _, ok := usedIdx[idx]; !ok {
				usedIdx[idx] = struct{}{}
				rule.RuleGroupIndex = idx
				return
			}
		}
	}
}

func WithSequentialGroupIndex() AlertRuleMutator {
	idx := 1
	return func(rule *AlertRule) {
		rule.RuleGroupIndex = idx
		idx++
	}
}

func WithOrgID(orgId int64) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.OrgID = orgId
	}
}

func WithNamespace(namespace *models2.Folder) AlertRuleMutator {
	return func(rule *AlertRule) {
		rule.NamespaceUID = namespace.Uid
	}
}

func GenerateAlertLabels(count int, prefix string) data.Labels {
	labels := make(data.Labels, count)
	for i := 0; i < count; i++ {
		labels[prefix+"key-"+util.GenerateShortUID()] = prefix + "value-" + util.GenerateShortUID()
	}
	return labels
}

func GenerateAlertQuery() AlertQuery {
	f := rand.Intn(10) + 5
	t := rand.Intn(f)

	return AlertQuery{
		DatasourceUID: util.GenerateShortUID(),
		Model: json.RawMessage(fmt.Sprintf(`{
			"%s": "%s",
			"%s":"%d"
		}`, util.GenerateShortUID(), util.GenerateShortUID(), util.GenerateShortUID(), rand.Int())),
		RelativeTimeRange: RelativeTimeRange{
			From: Duration(time.Duration(f) * time.Minute),
			To:   Duration(time.Duration(t) * time.Minute),
		},
		RefID:     util.GenerateShortUID(),
		QueryType: util.GenerateShortUID(),
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

// GenerateAlertRulesSmallNonEmpty generates 1 to 5 rules using the provided generator
func GenerateAlertRulesSmallNonEmpty(f func() *AlertRule) []*AlertRule {
	return GenerateAlertRules(rand.Intn(4)+1, f)
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

// GenerateRuleKey generates a random alert rule key
func GenerateRuleKey(orgID int64) AlertRuleKey {
	return AlertRuleKey{
		OrgID: orgID,
		UID:   util.GenerateShortUID(),
	}
}

// GenerateGroupKey generates a random group key
func GenerateGroupKey(orgID int64) AlertRuleGroupKey {
	return AlertRuleGroupKey{
		OrgID:        orgID,
		NamespaceUID: util.GenerateShortUID(),
		RuleGroup:    util.GenerateShortUID(),
	}
}

// CopyRule creates a deep copy of AlertRule
func CopyRule(r *AlertRule) *AlertRule {
	result := AlertRule{
		ID:              r.ID,
		OrgID:           r.OrgID,
		Title:           r.Title,
		Condition:       r.Condition,
		Updated:         r.Updated,
		IntervalSeconds: r.IntervalSeconds,
		Version:         r.Version,
		UID:             r.UID,
		NamespaceUID:    r.NamespaceUID,
		RuleGroup:       r.RuleGroup,
		RuleGroupIndex:  r.RuleGroupIndex,
		NoDataState:     r.NoDataState,
		ExecErrState:    r.ExecErrState,
		For:             r.For,
	}

	if r.DashboardUID != nil {
		dash := *r.DashboardUID
		result.DashboardUID = &dash
	}
	if r.PanelID != nil {
		p := *r.PanelID
		result.PanelID = &p
	}

	for _, d := range r.Data {
		q := AlertQuery{
			RefID:             d.RefID,
			QueryType:         d.QueryType,
			RelativeTimeRange: d.RelativeTimeRange,
			DatasourceUID:     d.DatasourceUID,
		}
		q.Model = make([]byte, 0, cap(d.Model))
		q.Model = append(q.Model, d.Model...)
		result.Data = append(result.Data, q)
	}

	if r.Annotations != nil {
		result.Annotations = make(map[string]string, len(r.Annotations))
		for s, s2 := range r.Annotations {
			result.Annotations[s] = s2
		}
	}

	if r.Labels != nil {
		result.Labels = make(map[string]string, len(r.Labels))
		for s, s2 := range r.Labels {
			result.Labels[s] = s2
		}
	}

	return &result
}
