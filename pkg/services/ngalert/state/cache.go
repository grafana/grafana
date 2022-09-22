package state

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type cache struct {
	states      map[int64]map[string]map[string]*State // orgID > alertRuleUID > stateID > state
	mtxStates   sync.RWMutex
	log         log.Logger
	metrics     *metrics.State
	externalURL *url.URL
}

func newCache(logger log.Logger, metrics *metrics.State, externalURL *url.URL) *cache {
	return &cache{
		states:      make(map[int64]map[string]map[string]*State),
		log:         logger,
		metrics:     metrics,
		externalURL: externalURL,
	}
}

func (c *cache) getOrCreate(ctx context.Context, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels) *State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()

	ruleLabels, annotations := c.expandRuleLabelsAndAnnotations(ctx, alertRule, result, extraLabels)

	lbs := make(data.Labels, len(extraLabels)+len(ruleLabels)+len(result.Instance))
	dupes := make(data.Labels)
	for key, val := range extraLabels {
		lbs[key] = val
	}
	for key, val := range ruleLabels {
		_, ok := lbs[key]
		// if duplicate labels exist, reserved label will take precedence
		if ok {
			dupes[key] = val
		} else {
			lbs[key] = val
		}
	}
	if len(dupes) > 0 {
		c.log.Warn("rule declares one or many reserved labels. Those rules labels will be ignored", "labels", dupes)
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
		c.log.Warn("evaluation result contains either reserved labels or labels declared in the rules. Those labels from the result will be ignored", "labels", dupes)
	}

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

func (c *cache) expandRuleLabelsAndAnnotations(ctx context.Context, alertRule *ngModels.AlertRule, alertInstance eval.Result, extraLabels data.Labels) (data.Labels, data.Labels) {
	// use labels from the result and extra labels to expand the labels and annotations declared by the rule
	templateLabels := mergeLabels(extraLabels, alertInstance.Instance)

	expand := func(original map[string]string) map[string]string {
		expanded := make(map[string]string, len(original))
		for k, v := range original {
			ev, err := expandTemplate(ctx, alertRule.Title, v, templateLabels, alertInstance, c.externalURL)
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

// removeByRuleUID deletes all entries in the state cache that match the given UID. Returns removed states
func (c *cache) removeByRuleUID(orgID int64, uid string) []*State {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	statesMap := c.states[orgID][uid]
	delete(c.states[orgID], uid)
	if statesMap == nil {
		return nil
	}
	states := make([]*State, 0, len(statesMap))
	for _, state := range statesMap {
		states = append(states, state)
	}
	return states
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

func (c *cache) deleteEntry(orgID int64, alertRuleUID, cacheID string) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	delete(c.states[orgID][alertRuleUID], cacheID)
}
