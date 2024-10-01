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

func (c *cache) getOrCreate(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) *State {
	// Calculation of state ID involves label and annotation expansion, which may be resource intensive operations, and doing it in the context guarded by mtxStates may create a lot of contention.
	// Instead of just calculating ID we create an entire state - a candidate. If rule states already hold a state with this ID, this candidate will be discarded and the existing one will be returned.
	// Otherwise, this candidate will be added to the rule states and returned.
	stateCandidate := calculateState(ctx, log, alertRule, result, extraLabels, externalURL)

	c.mtxStates.Lock()
	defer c.mtxStates.Unlock()

	var orgStates map[string]*ruleStates
	var ok bool
	if orgStates, ok = c.states[stateCandidate.OrgID]; !ok {
		orgStates = make(map[string]*ruleStates)
		c.states[stateCandidate.OrgID] = orgStates
	}
	var states *ruleStates
	if states, ok = orgStates[stateCandidate.AlertRuleUID]; !ok {
		states = &ruleStates{states: make(map[data.Fingerprint]*State)}
		c.states[stateCandidate.OrgID][stateCandidate.AlertRuleUID] = states
	}
	return states.getOrAdd(stateCandidate, log)
}

func (rs *ruleStates) getOrAdd(stateCandidate State, log log.Logger) *State {
	state, ok := rs.states[stateCandidate.CacheID]
	// Check if the state with this ID already exists.
	if !ok {
		rs.states[stateCandidate.CacheID] = &stateCandidate
		return &stateCandidate
	}

	// Annotations can change over time, however we also want to maintain
	// certain annotations across evaluations
	for k, v := range state.Annotations {
		if _, ok := ngModels.InternalAnnotationNameSet[k]; ok {
			// If the annotation is not present then it should be copied from the
			// previous state to the next state
			if _, ok := stateCandidate.Annotations[k]; !ok {
				stateCandidate.Annotations[k] = v
			}
		}
	}
	state.Annotations = stateCandidate.Annotations
	state.Values = stateCandidate.Values
	if state.ResultFingerprint != stateCandidate.ResultFingerprint {
		log.Info("Result fingerprint has changed", "oldFingerprint", state.ResultFingerprint, "newFingerprint", stateCandidate.ResultFingerprint, "cacheID", state.CacheID, "stateLabels", state.Labels.String())
		state.ResultFingerprint = stateCandidate.ResultFingerprint
	}
	rs.states[stateCandidate.CacheID] = state
	return state
}

func calculateState(ctx context.Context, log log.Logger, alertRule *ngModels.AlertRule, result eval.Result, extraLabels data.Labels, externalURL *url.URL) State {
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

	cacheID := lbs.Fingerprint()

	// For new states, we set StartsAt & EndsAt to EvaluatedAt as this is the
	// expected value for a Normal state during state transition.
	newState := State{
		AlertRuleUID:       alertRule.UID,
		OrgID:              alertRule.OrgID,
		CacheID:            cacheID,
		Labels:             lbs,
		Annotations:        annotations,
		EvaluationDuration: result.EvaluationDuration,
		StartsAt:           result.EvaluatedAt,
		EndsAt:             result.EvaluatedAt,
		ResultFingerprint:  result.Instance.Fingerprint(), // remember original result fingerprint
	}
	return newState
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

// asInstances returns the whole content of the cache as a slice of AlertInstance.
func (c *cache) asInstances(skipNormalState bool) []ngModels.AlertInstance {
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
