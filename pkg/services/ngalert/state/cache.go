package state

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state/template"
)

type ruleStates struct {
	states map[data.Fingerprint]*State
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

// RegisterMetrics registers a set of Gauges in the form of collectors for the alerts in the cache.
func (c *cache) RegisterMetrics(r prometheus.Registerer) {
	newAlertCountByState := func(state eval.State) prometheus.GaugeFunc {
		return prometheus.NewGaugeFunc(prometheus.GaugeOpts{
			Namespace:   metrics.Namespace,
			Subsystem:   metrics.Subsystem,
			Name:        "alerts",
			Help:        "How many alerts by state are in the scheduler.",
			ConstLabels: prometheus.Labels{"state": strings.ToLower(state.String())},
		}, func() float64 {
			return c.countAlertsBy(state)
		})
	}

	r.MustRegister(newAlertCountByState(eval.Normal))
	r.MustRegister(newAlertCountByState(eval.Alerting))
	r.MustRegister(newAlertCountByState(eval.Pending))
	r.MustRegister(newAlertCountByState(eval.Error))
	r.MustRegister(newAlertCountByState(eval.NoData))
}

func (c *cache) countAlertsBy(state eval.State) float64 {
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	var count float64
	for _, orgMap := range c.states {
		for _, rule := range orgMap {
			for _, st := range rule.states {
				if st.State == state {
					count++
				}
			}
		}
	}

	return count
}

func expandAnnotationsAndLabels(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) (data.Labels, data.Labels) {
	var reserved []string
	resultLabels := result.Instance
	if len(resultLabels) > 0 {
		for key := range ngModels.LabelsUserCannotSpecify {
			if value, ok := resultLabels[key]; ok {
				if reserved == nil { // make a copy of labels if we are going to modify it
					resultLabels = result.Instance.Copy()
				}
				reserved = append(reserved, key)
				delete(resultLabels, key)
				// we cannot delete the reserved label completely because it can cause alert instances to collide (when this label is only unique across results)
				// so we just rename it to something that does not collide with reserved labels
				newKey := strings.TrimSuffix(strings.TrimPrefix(key, "__"), "__")
				if _, ok = resultLabels[newKey]; newKey == "" || newKey == key || ok { // in the case if in the future the LabelsUserCannotSpecify contains labels that do not have double underscore
					newKey = key + "_user"
				}
				if _, ok = resultLabels[newKey]; !ok { // if it still collides with another existing label, we just drop the label
					resultLabels[newKey] = value
				} else {
					log.Warn("Result contains reserved label, and, after renaming, a new label collides with an existing one. Removing the label completely", "deletedLabel", key, "renamedLabel", newKey)
				}
			}
		}
		if len(reserved) > 0 {
			log.Debug("Found collision of result labels and system reserved. Renamed labels with suffix '_user'", "renamedLabels", strings.Join(reserved, ","))
		}
	}
	// Merge both the extra labels and the labels from the evaluation into a common set
	// of labels that can be expanded in custom labels and annotations.
	templateData := template.NewData(mergeLabels(extraLabels, resultLabels), result)

	// For now, do nothing with these errors as they are already logged in expand.
	// In the future, we want to show these errors to the user somehow.
	labels, _ := expand(ctx, log, alertRule.Title, alertRule.Labels, templateData, externalURL, result.EvaluatedAt)
	annotations, _ := expand(ctx, log, alertRule.Title, alertRule.Annotations, templateData, externalURL, result.EvaluatedAt)

	lbs := make(data.Labels, len(extraLabels)+len(labels)+len(resultLabels))
	dupes := make(data.Labels)
	for key, val := range extraLabels {
		lbs[key] = val
	}
	for key, val := range labels {
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
		log.Debug("Rule declares one or many reserved labels. Those rules labels will be ignored", "labels", dupes)
	}
	dupes = make(data.Labels)
	for key, val := range resultLabels {
		_, ok := lbs[key]
		// if duplicate labels exist, reserved or alert rule label will take precedence
		if ok {
			dupes[key] = val
		} else {
			lbs[key] = val
		}
	}
	if len(dupes) > 0 {
		log.Debug("Evaluation result contains either reserved labels or labels declared in the rules. Those labels from the result will be ignored", "labels", dupes)
	}
	return lbs, annotations
}

func (c *cache) create(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) *State {
	lbs, annotations := expandAnnotationsAndLabels(ctx, log, alertRule, result, extraLabels, externalURL)

	cacheID := lbs.Fingerprint()
	// For new states, we set StartsAt & EndsAt to EvaluatedAt as this is the
	// expected value for a Normal state during state transition.
	newState := State{
		OrgID:                alertRule.OrgID,
		AlertRuleUID:         alertRule.UID,
		CacheID:              cacheID,
		State:                eval.Normal,
		StateReason:          "",
		ResultFingerprint:    result.Instance.Fingerprint(), // remember original result fingerprint
		LatestResult:         nil,
		Error:                nil,
		Image:                nil,
		Annotations:          annotations,
		Labels:               lbs,
		Values:               nil,
		StartsAt:             result.EvaluatedAt,
		EndsAt:               result.EvaluatedAt,
		ResolvedAt:           nil,
		LastSentAt:           nil,
		LastEvaluationString: "",
		LastEvaluationTime:   result.EvaluatedAt,
		EvaluationDuration:   result.EvaluationDuration,
	}

	existingState := c.get(alertRule.OrgID, alertRule.UID, cacheID)
	if existingState == nil {
		return &newState
	}
	// if there is existing state, copy over the current values that may be needed to determine the final state.
	// TODO remove some unnecessary assignments below because they are overridden in setNextState
	newState.State = existingState.State
	newState.StateReason = existingState.StateReason
	newState.Image = existingState.Image
	newState.LatestResult = existingState.LatestResult
	newState.Error = existingState.Error
	newState.Values = existingState.Values
	newState.LastEvaluationString = existingState.LastEvaluationString
	newState.StartsAt = existingState.StartsAt
	newState.EndsAt = existingState.EndsAt
	newState.ResolvedAt = existingState.ResolvedAt
	newState.LastSentAt = existingState.LastSentAt
	// Annotations can change over time, however we also want to maintain
	// certain annotations across evaluations
	for key := range ngModels.InternalAnnotationNameSet { // Changing in
		value, ok := existingState.Annotations[key]
		if !ok {
			continue
		}
		// If the annotation is not present then it should be copied from
		// the current state to the new state
		if _, ok = newState.Annotations[key]; !ok {
			newState.Annotations[key] = value
		}
	}

	// if the current state is "data source error" then it may have additional labels that may not exist in the new state.
	// See https://github.com/grafana/grafana/blob/c7fdf8ce706c2c9d438f5e6eabd6e580bac4946b/pkg/services/ngalert/state/state.go#L161-L163
	// copy known labels over to the new instance, it can help reduce flapping
	// TODO fix this?
	if existingState.State == eval.Error && result.State == eval.Error {
		setIfExist := func(lbl string) {
			if v, ok := existingState.Labels[lbl]; ok {
				newState.Labels[lbl] = v
			}
		}
		setIfExist("datasource_uid")
		setIfExist("ref_id")
	}
	return &newState
}

// expand returns the expanded templates of all annotations or labels for the template data.
// If a template cannot be expanded due to an error in the template the original template is
// maintained and an error is added to the multierror. All errors in the multierror are
// template.ExpandError errors.
func expand(ctx context.Context, log log.Logger, name string, original map[string]string, data template.Data, externalURL *url.URL, evaluatedAt time.Time) (map[string]string, error) {
	var (
		errs     error
		expanded = make(map[string]string, len(original))
	)
	for k, v := range original {
		result, err := template.Expand(ctx, name, v, data, externalURL, evaluatedAt)
		if err != nil {
			log.Error("Error in expanding template", "error", err)
			errs = errors.Join(errs, err)
			// keep the original template on error
			expanded[k] = v
		} else {
			expanded[k] = result
		}
	}
	return expanded, errs
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

func (c *cache) setRuleStates(ruleKey ngModels.AlertRuleKey, s ruleStates) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	if _, ok := c.states[ruleKey.OrgID]; !ok {
		c.states[ruleKey.OrgID] = make(map[string]*ruleStates)
	}
	c.states[ruleKey.OrgID][ruleKey.UID] = &s
}

func (c *cache) set(entry *State) {
	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()
	if _, ok := c.states[entry.OrgID]; !ok {
		c.states[entry.OrgID] = make(map[string]*ruleStates)
	}
	if _, ok := c.states[entry.OrgID][entry.AlertRuleUID]; !ok {
		c.states[entry.OrgID][entry.AlertRuleUID] = &ruleStates{states: make(map[data.Fingerprint]*State)}
	}
	c.states[entry.OrgID][entry.AlertRuleUID].states[entry.CacheID] = entry
}

func (c *cache) get(orgID int64, alertRuleUID string, stateId data.Fingerprint) *State {
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

// GetAlertInstances returns the whole content of the cache as a slice of AlertInstance.
func (c *cache) GetAlertInstances(skipNormalState bool) []ngModels.AlertInstance {
	var states []ngModels.AlertInstance
	c.mtxStates.RLock()
	defer c.mtxStates.RUnlock()
	for _, orgStates := range c.states {
		for _, v1 := range orgStates {
			for _, v2 := range v1.states {
				if skipNormalState && IsNormalStateWithNoReason(v2) {
					continue
				}
				key, err := v2.GetAlertInstanceKey()
				if err != nil {
					continue
				}
				states = append(states, ngModels.AlertInstance{
					AlertInstanceKey:  key,
					Labels:            ngModels.InstanceLabels(v2.Labels),
					CurrentState:      ngModels.InstanceStateType(v2.State.String()),
					CurrentReason:     v2.StateReason,
					LastEvalTime:      v2.LastEvaluationTime,
					CurrentStateSince: v2.StartsAt,
					CurrentStateEnd:   v2.EndsAt,
					ResolvedAt:        v2.ResolvedAt,
					LastSentAt:        v2.LastSentAt,
					ResultFingerprint: v2.ResultFingerprint.String(),
				})
			}
		}
	}
	return states
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
