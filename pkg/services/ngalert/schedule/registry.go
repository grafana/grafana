package schedule

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type alertRuleRegistry struct {
	mu            sync.Mutex
	alertRuleInfo map[models.AlertRuleKey]*alertRuleInfo
}

// getOrCreateInfo gets rule routine information from registry by the key. If it does not exist, it creates a new one.
// Returns a pointer to the rule routine information and a flag that indicates whether it is a new struct or not.
func (r *alertRuleRegistry) getOrCreateInfo(context context.Context, key models.AlertRuleKey) (*alertRuleInfo, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		info = newAlertRuleInfo(context)
		r.alertRuleInfo[key] = info
	}
	return info, !ok
}

// get returns the channel for the specific alert rule
// if the key does not exist returns an error
func (r *alertRuleRegistry) get(key models.AlertRuleKey) (*alertRuleInfo, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	info, ok := r.alertRuleInfo[key]
	if !ok {
		return nil, fmt.Errorf("%v key not found", key)
	}
	return info, nil
}

func (r *alertRuleRegistry) exists(key models.AlertRuleKey) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	_, ok := r.alertRuleInfo[key]
	return ok
}

// del removes pair that has specific key from alertRuleInfo.
// Returns 2-tuple where the first element is value of the removed pair
// and the second element indicates whether element with the specified key existed.
func (r *alertRuleRegistry) del(key models.AlertRuleKey) (*alertRuleInfo, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	info, ok := r.alertRuleInfo[key]
	if ok {
		delete(r.alertRuleInfo, key)
	}
	return info, ok
}

func (r *alertRuleRegistry) keyMap() map[models.AlertRuleKey]struct{} {
	r.mu.Lock()
	defer r.mu.Unlock()
	definitionsIDs := make(map[models.AlertRuleKey]struct{}, len(r.alertRuleInfo))
	for k := range r.alertRuleInfo {
		definitionsIDs[k] = struct{}{}
	}
	return definitionsIDs
}

type alertRuleInfo struct {
	evalCh   chan *evaluation
	updateCh chan struct{}
	ctx      context.Context
	stop     context.CancelFunc
}

func newAlertRuleInfo(parent context.Context) *alertRuleInfo {
	ctx, cancel := context.WithCancel(parent)
	return &alertRuleInfo{evalCh: make(chan *evaluation), updateCh: make(chan struct{}), ctx: ctx, stop: cancel}
}

// eval signals the rule evaluation routine to perform the evaluation of the rule. Does nothing if the loop is stopped
func (a *alertRuleInfo) eval(t time.Time, version int64) bool {
	select {
	case a.evalCh <- &evaluation{
		scheduledAt: t,
		version:     version,
	}:
		return true
	case <-a.ctx.Done():
		return false
	}
}

// update signals the rule evaluation routine to update the internal state. Does nothing if the loop is stopped
func (a *alertRuleInfo) update() bool {
	select {
	case a.updateCh <- struct{}{}:
		return true
	case <-a.ctx.Done():
		return false
	}
}

type evaluation struct {
	scheduledAt time.Time
	version     int64
}
