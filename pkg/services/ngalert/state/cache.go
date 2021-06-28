package state

import (
	"bytes"
	"fmt"
	"strings"
	"sync"
	text_template "text/template"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	prometheusModel "github.com/prometheus/common/model"
)

type cache struct {
	states    map[int64]map[string]map[string]*State // orgID > alertRuleUID > stateID > state
	mtxStates sync.RWMutex
	log       log.Logger
	metrics   *metrics.Metrics
}

func newCache(logger log.Logger, metrics *metrics.Metrics) *cache {
	return &cache{
		states:  make(map[int64]map[string]map[string]*State),
		log:     logger,
		metrics: metrics,
	}
}

func (c *cache) getOrCreate(alertRule *ngModels.AlertRule, result eval.Result) *State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()

	templateData := make(map[string]string, len(result.Instance)+3)
	for k, v := range result.Instance {
		templateData[k] = v
	}
	attachRuleLabels(templateData, alertRule)
	ruleLabels, annotations := c.expandRuleLabelsAndAnnotations(alertRule, templateData)

	// if duplicate labels exist, alertRule label will take precedence
	lbs := mergeLabels(ruleLabels, result.Instance)
	attachRuleLabels(lbs, alertRule)

	il := ngModels.InstanceLabels(lbs)
	id, err := il.StringKey()
	if err != nil {
		c.log.Error("error getting cacheId for entry", "err", err.Error())
	}

	if _, ok := c.states[alertRule.OrgID]; !ok {
		c.states[alertRule.OrgID] = make(map[string]map[string]*State)
	}
	if _, ok := c.states[alertRule.OrgID][alertRule.UID]; !ok {
		c.states[alertRule.OrgID][alertRule.UID] = make(map[string]*State)
	}

	if state, ok := c.states[alertRule.OrgID][alertRule.UID][id]; ok {
		// Annotations can change over time for the same alert.
		state.Annotations = annotations
		c.states[alertRule.OrgID][alertRule.UID][id] = state
		return state
	}

	// If the first result we get is alerting, set StartsAt to EvaluatedAt because we
	// do not have data for determining StartsAt otherwise
	newState := &State{
		AlertRuleUID:       alertRule.UID,
		OrgID:              alertRule.OrgID,
		CacheId:            id,
		Labels:             lbs,
		Annotations:        annotations,
		EvaluationDuration: result.EvaluationDuration,
	}
	if result.State == eval.Alerting {
		newState.StartsAt = result.EvaluatedAt
	}
	c.states[alertRule.OrgID][alertRule.UID][id] = newState
	return newState
}

func attachRuleLabels(m map[string]string, alertRule *ngModels.AlertRule) {
	m[ngModels.RuleUIDLabel] = alertRule.UID
	m[ngModels.NamespaceUIDLabel] = alertRule.NamespaceUID
	m[prometheusModel.AlertNameLabel] = alertRule.Title
}

func (c *cache) expandRuleLabelsAndAnnotations(alertRule *ngModels.AlertRule, data map[string]string) (map[string]string, map[string]string) {
	expand := func(original map[string]string) map[string]string {
		expanded := make(map[string]string, len(original))
		for k, v := range original {
			ev, err := expandTemplate(alertRule.Title, v, data)
			expanded[k] = ev
			if err != nil {
				c.log.Error("error in expanding template", "name", k, "value", v, "err", err.Error())
				// Store the original template on error.
				expanded[k] = v
			}
		}

		return expanded
	}

	return expand(alertRule.Labels), expand(alertRule.Annotations)
}

func expandTemplate(name, text string, data map[string]string) (result string, resultErr error) {
	name = "__alert_" + name
	text = "{{- $labels := .Labels -}}" + text
	// It'd better to have no alert description than to kill the whole process
	// if there's a bug in the template.
	defer func() {
		if r := recover(); r != nil {
			var ok bool
			resultErr, ok = r.(error)
			if !ok {
				resultErr = fmt.Errorf("panic expanding template %v: %v", name, r)
			}
		}
	}()

	tmpl, err := text_template.New(name).Option("missingkey=zero").Parse(text)
	if err != nil {
		return "", fmt.Errorf("error parsing template %v: %s", name, err.Error())
	}
	var buffer bytes.Buffer
	err = tmpl.Execute(&buffer, struct {
		Labels map[string]string
	}{
		Labels: data,
	})
	if err != nil {
		return "", fmt.Errorf("error executing template %v: %s", name, err.Error())
	}
	return buffer.String(), nil
}

func (c *cache) set(entry *State) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	if _, ok := c.states[entry.OrgID]; !ok {
		c.states[entry.OrgID] = make(map[string]map[string]*State)
	}
	if _, ok := c.states[entry.OrgID][entry.AlertRuleUID]; !ok {
		c.states[entry.OrgID][entry.AlertRuleUID] = make(map[string]*State)
	}
	c.states[entry.OrgID][entry.AlertRuleUID][entry.CacheId] = entry
}

func (c *cache) get(orgID int64, alertRuleUID, stateId string) (*State, error) {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	if state, ok := c.states[orgID][alertRuleUID][stateId]; ok {
		return state, nil
	}
	return nil, fmt.Errorf("no entry for %s:%s was found", alertRuleUID, stateId)
}

func (c *cache) getAll(orgID int64) []*State {
	var states []*State
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	for _, v1 := range c.states[orgID] {
		for _, v2 := range v1 {
			states = append(states, v2)
		}
	}
	return states
}

func (c *cache) getStatesForRuleUID(orgID int64, alertRuleUID string) []*State {
	var ruleStates []*State
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	for _, state := range c.states[orgID][alertRuleUID] {
		ruleStates = append(ruleStates, state)
	}
	return ruleStates
}

// removeByRuleUID deletes all entries in the state cache that match the given UID.
func (c *cache) removeByRuleUID(orgID int64, uid string) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	delete(c.states[orgID], uid)
}

func (c *cache) reset() {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	c.states = make(map[int64]map[string]map[string]*State)
}

func (c *cache) recordMetrics() {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()

	// Set default values to zero such that gauges are reset
	// after all values from a single state disappear.
	ct := map[eval.State]int{
		eval.Normal:   0,
		eval.Alerting: 0,
		eval.Pending:  0,
		eval.NoData:   0,
		eval.Error:    0,
	}

	for org, orgMap := range c.states {
		c.metrics.GroupRules.WithLabelValues(fmt.Sprint(org)).Set(float64(len(orgMap)))
		for _, rule := range orgMap {
			for _, state := range rule {
				n := ct[state.State]
				ct[state.State] = n + 1
			}
		}
	}

	for k, n := range ct {
		c.metrics.AlertState.WithLabelValues(strings.ToLower(k.String())).Set(float64(n))
	}
}

// if duplicate labels exist, keep the value from the first set
func mergeLabels(a, b data.Labels) data.Labels {
	newLbs := data.Labels{}
	for k, v := range a {
		newLbs[k] = v
	}
	for k, v := range b {
		if _, ok := newLbs[k]; !ok {
			newLbs[k] = v
		}
	}
	return newLbs
}
