package state

import (
	"context"
	"fmt"
	"math"
	"net/url"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ruleStates struct {
	states map[string]*State
}

type cache struct {
	states    map[int64]map[string]*ruleStates // orgID > alertRuleUID > stateID > state
	mtxStates sync.RWMutex
}

func newCache() *cache {
	return &cache{
		states: make(map[int64]map[string]*ruleStates),
	}
}

func (c *cache) getOrCreate(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) *State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	var orgStates map[string]*ruleStates
	var ok bool
	if orgStates, ok = c.states[alertRule.OrgID]; !ok {
		orgStates = make(map[string]*ruleStates)
		c.states[alertRule.OrgID] = orgStates
	}
	var states *ruleStates
	if states, ok = orgStates[alertRule.UID]; !ok {
		states = &ruleStates{states: make(map[string]*State)}
		c.states[alertRule.OrgID][alertRule.UID] = states
	}
	return states.getOrCreate(ctx, log, alertRule, result, extraLabels, externalURL)
}

func (rs *ruleStates) getOrCreate(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) *State {
	ruleLabels, annotations := rs.expandRuleLabelsAndAnnotations(ctx, log, alertRule, result, extraLabels, externalURL)

	values := make(map[string]float64)
	for _, v := range result.Values {
		if v.Value != nil {
			values[v.Var] = *v.Value
		} else {
			values[v.Var] = math.NaN()
		}
	}

	lbs := make(data.Labels, len(extraLabels)+len(ruleLabels)+len(result.Instance))
	dupes := make(data.Labels)
	for key, val := range extraLabels {
		lbs[key] = val
	}
	for key, val := range ruleLabels {
		ruleVal, ok := lbs[key]
		// if duplicate labels exist, reserved label will take precedence
		if ok {
			if ruleVal != val {
				dupes[key] = val
			}
		} else {
			lbs[key] = val
		}
	}
	if len(dupes) > 0 {
		log.Warn("Rule declares one or many reserved labels. Those rules labels will be ignored", "labels", dupes)
	}
	dupes = make(data.Labels)
	for key, val := range result.Instance {
		_, ok := lbs[key]
		// if duplicate labels exist, reserved or alert rule label will take precedence
		if ok {
			dupes[key] = val
		} else {
			lbs[key] = val
		}
	}
	if len(dupes) > 0 {
		log.Warn("Evaluation result contains either reserved labels or labels declared in the rules. Those labels from the result will be ignored", "labels", dupes)
	}

	il := ngModels.InstanceLabels(lbs)
	id, err := il.StringKey()
	if err != nil {
		log.Error("Error getting cacheId for entry", "error", err)
	}

	if state, ok := rs.states[id]; ok {
		// Annotations can change over time, however we also want to maintain
		// certain annotations across evaluations
		for k, v := range state.Annotations {
			if _, ok := ngModels.InternalAnnotationNameSet[k]; ok {
				// If the annotation is not present then it should be copied from the
				// previous state to the next state
				if _, ok := annotations[k]; !ok {
					annotations[k] = v
				}
			}
		}
		state.Annotations = annotations
		state.Values = values
		rs.states[id] = state
		return state
	}

	// If the first result we get is alerting, set StartsAt to EvaluatedAt because we
	// do not have data for determining StartsAt otherwise
	newState := &State{
		AlertRuleUID:       alertRule.UID,
		OrgID:              alertRule.OrgID,
		CacheID:            id,
		Labels:             lbs,
		Annotations:        annotations,
		EvaluationDuration: result.EvaluationDuration,
		Values:             values,
	}
	if result.State == eval.Alerting {
		newState.StartsAt = result.EvaluatedAt
	}
	rs.states[id] = newState
	return newState
}

func (rs *ruleStates) expandRuleLabelsAndAnnotations(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, alertInstance eval.Result, extraLabels data.Labels, externalURL *url.URL) (data.Labels, data.Labels) {
	// use labels from the result and extra labels to expand the labels and annotations declared by the rule
	templateLabels := mergeLabels(extraLabels, alertInstance.Instance)

	expand := func(original map[string]string) map[string]string {
		expanded := make(map[string]string, len(original))
		for k, v := range original {
			ev, err := expandTemplate(ctx, alertRule.Title, v, templateLabels, alertInstance, externalURL)
			expanded[k] = ev
			if err != nil {
				log.Error("Error in expanding template", "name", k, "value", v, "error", err)
				// Store the original template on error.
				expanded[k] = v
			}
		}

		return expanded
	}
	return expand(alertRule.Labels), expand(alertRule.Annotations)
}

func (rs *ruleStates) deleteStates(predicate func(s *State) bool) []*State {
	deleted := make([]*State, 0)
	for id, state := range rs.states {
		if predicate(state) {
			delete(rs.states, id)
			deleted = append(deleted, state)
		}
	}
	return deleted
}

func (c *cache) deleteRuleStates(ruleKey ngModels.AlertRuleKey, predicate func(s *State) bool) []*State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	ruleStates, ok := c.states[ruleKey.OrgID][ruleKey.UID]
	if ok {
		return ruleStates.deleteStates(predicate)
	}
	return nil
}

func (c *cache) setAllStates(newStates map[int64]map[string]*ruleStates) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	c.states = newStates
}

func (c *cache) set(entry *State) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	if _, ok := c.states[entry.OrgID]; !ok {
		c.states[entry.OrgID] = make(map[string]*ruleStates)
	}
	if _, ok := c.states[entry.OrgID][entry.AlertRuleUID]; !ok {
		c.states[entry.OrgID][entry.AlertRuleUID] = &ruleStates{states: make(map[string]*State)}
	}
	c.states[entry.OrgID][entry.AlertRuleUID].states[entry.CacheID] = entry
}

func (c *cache) get(orgID int64, alertRuleUID, stateId string) *State {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	ruleStates, ok := c.states[orgID][alertRuleUID]
	if ok {
		var state *State
		state, ok = ruleStates.states[stateId]
		if ok {
			return state
		}
	}
	return nil
}

func (c *cache) getAll(orgID int64, skipNormalState bool) []*State {
	var states []*State
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	for _, v1 := range c.states[orgID] {
		for _, v2 := range v1.states {
			if skipNormalState && IsNormalStateWithNoReason(v2) {
				continue
			}
			states = append(states, v2)
		}
	}
	return states
}

func (c *cache) getStatesForRuleUID(orgID int64, alertRuleUID string, skipNormalState bool) []*State {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	orgRules, ok := c.states[orgID]
	if !ok {
		return nil
	}
	rs, ok := orgRules[alertRuleUID]
	if !ok {
		return nil
	}
	result := make([]*State, 0, len(rs.states))
	for _, state := range rs.states {
		if skipNormalState && IsNormalStateWithNoReason(state) {
			continue
		}
		result = append(result, state)
	}
	return result
}

// removeByRuleUID deletes all entries in the state cache that match the given UID. Returns removed states
func (c *cache) removeByRuleUID(orgID int64, uid string) []*State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	orgStates, ok := c.states[orgID]
	if !ok {
		return nil
	}
	rs, ok := orgStates[uid]
	if !ok {
		return nil
	}
	delete(c.states[orgID], uid)
	if len(rs.states) == 0 {
		return nil
	}
	states := make([]*State, 0, len(rs.states))
	for _, state := range rs.states {
		states = append(states, state)
	}
	return states
}

func (c *cache) recordMetrics(metrics *metrics.State) {
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
		metrics.GroupRules.WithLabelValues(fmt.Sprint(org)).Set(float64(len(orgMap)))
		for _, rule := range orgMap {
			for _, state := range rule.states {
				n := ct[state.State]
				ct[state.State] = n + 1
			}
		}
	}

	for k, n := range ct {
		metrics.AlertState.WithLabelValues(strings.ToLower(k.String())).Set(float64(n))
	}
}

// if duplicate labels exist, keep the value from the first set
func mergeLabels(a, b data.Labels) data.Labels {
	newLbs := make(data.Labels, len(a)+len(b))
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
