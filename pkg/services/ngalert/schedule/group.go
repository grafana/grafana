package schedule

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// GroupKey uniquely identifies a rule group
type GroupKey struct {
	NamespaceUID string
	RuleGroup    string
	FolderTitle  string
}

// Group represents a collection of alert rules that belong to the same rule group
type Group struct {
	log     log.Logger
	metrics *metrics.Scheduler
	rules   []readyToRunItem
	sorted  bool
}

// NewGroup creates a new Group for a specific rule group
func NewGroup(logger log.Logger, metrics *metrics.Scheduler) *Group {
	return &Group{
		log:     logger,
		metrics: metrics,
		rules:   make([]readyToRunItem, 0),
	}
}

// AddRule adds a single rule to the group
func (g *Group) AddRule(item readyToRunItem) {
	g.rules = append(g.rules, item)
}

// Sort sorts the rules in the group by their group index
func (g *Group) Sort() {
	if g.sorted {
		return
	}
	slices.SortFunc(g.rules, func(a, b readyToRunItem) int {
		return ngmodels.RulesGroupComparer(a.rule, b.rule)
	})
	g.sorted = true
}

// Evaluate evaluates all rules in the group in the correct order
func (g *Group) Evaluate() {
	if len(g.rules) == 0 {
		return
	}

	if !g.sorted {
		// Sort rules by their group index before evaluation
		g.Sort()
	}

	g.evaluateSequentially()
}

// evaluateSequentially evaluates all rules in the group one after another
func (g *Group) evaluateSequentially() {
	for i, ruleItem := range g.rules {
		key := ruleItem.rule.GetKey()
		tick := ruleItem.scheduledAt

		// Create a channel to signal when evaluation is complete
		evalDone := make(chan struct{})

		// Set the afterEval callback on the existing evaluation
		ruleItem.afterEval = func() { close(evalDone) }

		// Send a signal to the rule routine to evaluate the rule
		success, dropped := ruleItem.ruleRoutine.Eval(&ruleItem.Evaluation)
		if !success {
			// Routine was stopped or context was cancelled
			g.log.Debug("Scheduled evaluation was canceled because evaluation routine was stopped", append(key.LogContext(), "time", tick)...)
			return
		}
		if dropped != nil {
			// Previous evaluation signal was dropped because the rule routine was busy
			g.log.Warn("Tick dropped because alert rule evaluation is too slow", append(key.LogContext(), "time", tick, "droppedTick", dropped.scheduledAt)...)
			orgID := fmt.Sprint(key.OrgID)
			g.metrics.EvaluationMissed.WithLabelValues(orgID, ruleItem.rule.Title).Inc()
		}
		// Wait for the rule evaluation to complete before continuing to the next rule
		<-evalDone
		g.log.Debug("Rule evaluation completed, continuing with next rule",
			append(key.LogContext(), "time", tick, "index", i, "total", len(g.rules))...)
	}
}

func (g *Group) Rules() []readyToRunItem {
	return g.rules
}
