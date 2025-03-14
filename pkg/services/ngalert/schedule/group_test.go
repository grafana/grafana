package schedule

import (
	"bytes"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// FakeRule implements the Rule interface using function fields
type FakeRule struct {
	RunFn        func() error
	StopFn       func(reason error)
	EvalFn       func(eval *Evaluation) (bool, *Evaluation)
	UpdateFn     func(eval *Evaluation) bool
	TypeFn       func() ngmodels.RuleType
	StatusFn     func() ngmodels.RuleStatus
	IdentifierFn func() ngmodels.AlertRuleKeyWithGroup

	// Additional fields to mimic real rule behavior
	busy           bool
	lastEvaluation *Evaluation
}

func (f *FakeRule) Run() error {
	if f.RunFn != nil {
		return f.RunFn()
	}
	return nil
}

func (f *FakeRule) Stop(reason error) {
	if f.StopFn != nil {
		f.StopFn(reason)
	}
}

func (f *FakeRule) Eval(eval *Evaluation) (bool, *Evaluation) {
	// If the rule is busy, return the last evaluation as dropped
	if f.busy {
		droppedEval := f.lastEvaluation
		return true, droppedEval
	}

	// Mark the rule as busy during evaluation
	f.busy = true
	f.lastEvaluation = eval

	var success bool
	var dropped *Evaluation

	if f.EvalFn != nil {
		success, dropped = f.EvalFn(eval)
	} else {
		success, dropped = true, nil
	}

	// Always call afterEval if it's set, regardless of success or failure
	if eval.afterEval != nil {
		eval.afterEval()
	}

	// Mark the rule as no longer busy after evaluation
	f.busy = false

	return success, dropped
}

func (f *FakeRule) Update(eval *Evaluation) bool {
	if f.UpdateFn != nil {
		return f.UpdateFn(eval)
	}
	return true
}

func (f *FakeRule) Type() ngmodels.RuleType {
	if f.TypeFn != nil {
		return f.TypeFn()
	}
	return ngmodels.RuleTypeAlerting
}

func (f *FakeRule) Status() ngmodels.RuleStatus {
	if f.StatusFn != nil {
		return f.StatusFn()
	}
	return ngmodels.RuleStatus{}
}

func (f *FakeRule) Identifier() ngmodels.AlertRuleKeyWithGroup {
	if f.IdentifierFn != nil {
		return f.IdentifierFn()
	}
	return ngmodels.AlertRuleKeyWithGroup{}
}

func newTestGroup() (*Group, *metrics.Scheduler) {
	reg := prometheus.NewRegistry()
	m := metrics.NewSchedulerMetrics(reg)
	return NewGroup(log.NewNopLogger(), m), m
}

// TestGroupBasicOperations tests the basic operations of a Group
func TestGroupBasicOperations(t *testing.T) {
	t.Run("AddRule", func(t *testing.T) {
		g, _ := newTestGroup()

		// Create a fake rule
		fakeRule := &FakeRule{}

		// Create a test rule
		rule := &ngmodels.AlertRule{
			ID:      1,
			OrgID:   1,
			Title:   "Test Rule",
			UID:     "test-rule",
			Version: 1,
		}

		// Create a readyToRunItem
		item := readyToRunItem{
			ruleRoutine: fakeRule,
			Evaluation: Evaluation{
				scheduledAt: time.Now(),
				rule:        rule,
				folderTitle: "Test Folder",
			},
		}

		// Add the rule to the group
		g.AddRule(item)

		// Verify the rule was added
		assert.Len(t, g.rules, 1)
		assert.Equal(t, item, g.rules[0])
	})

	t.Run("Rules", func(t *testing.T) {
		g, _ := newTestGroup()

		// Create test rules
		rule1 := &ngmodels.AlertRule{
			ID:    1,
			Title: "Test Rule 1",
		}

		rule2 := &ngmodels.AlertRule{
			ID:    2,
			Title: "Test Rule 2",
		}

		// Create readyToRunItems
		item1 := readyToRunItem{
			ruleRoutine: &FakeRule{},
			Evaluation: Evaluation{
				rule: rule1,
			},
		}

		item2 := readyToRunItem{
			ruleRoutine: &FakeRule{},
			Evaluation: Evaluation{
				rule: rule2,
			},
		}

		// Add rules to the group
		g.AddRule(item1)
		g.AddRule(item2)

		// Get the rules
		rules := g.Rules()

		// Verify the rules are returned correctly
		require.Len(t, rules, 2)
		assert.Equal(t, item1, rules[0])
		assert.Equal(t, item2, rules[1])
	})

	t.Run("Sort", func(t *testing.T) {
		g, _ := newTestGroup()

		// Create test rules with different group indices
		rule1 := &ngmodels.AlertRule{
			ID:             1,
			OrgID:          1,
			Title:          "Test Rule 1",
			UID:            "test-rule-1",
			RuleGroupIndex: 2, // Middle index
			Version:        1,
		}

		rule2 := &ngmodels.AlertRule{
			ID:             2,
			OrgID:          1,
			Title:          "Test Rule 2",
			UID:            "test-rule-2",
			RuleGroupIndex: 1, // Lowest index
			Version:        1,
		}

		rule3 := &ngmodels.AlertRule{
			ID:             3,
			OrgID:          1,
			Title:          "Test Rule 3",
			UID:            "test-rule-3",
			RuleGroupIndex: 3, // Highest index
			Version:        1,
		}

		// Add rules in random order
		g.AddRule(readyToRunItem{
			ruleRoutine: &FakeRule{},
			Evaluation: Evaluation{
				rule: rule1,
			},
		})

		g.AddRule(readyToRunItem{
			ruleRoutine: &FakeRule{},
			Evaluation: Evaluation{
				rule: rule3,
			},
		})

		g.AddRule(readyToRunItem{
			ruleRoutine: &FakeRule{},
			Evaluation: Evaluation{
				rule: rule2,
			},
		})

		// Sort the rules
		g.Sort()

		// Verify the rules are sorted by group index
		assert.Equal(t, rule2.UID, g.rules[0].rule.UID)
		assert.Equal(t, rule1.UID, g.rules[1].rule.UID)
		assert.Equal(t, rule3.UID, g.rules[2].rule.UID)

		// Verify the sorted flag is set
		assert.True(t, g.sorted)

		// Calling Sort again should be a no-op
		originalRules := g.rules
		g.Sort()
		assert.Equal(t, originalRules, g.rules)
	})
}

// TestGroupEvaluation tests the evaluation functionality of a Group
func TestGroupEvaluation(t *testing.T) {
	t.Run("EmptyGroup", func(t *testing.T) {
		g, _ := newTestGroup()

		// Evaluate an empty group (should be a no-op)
		g.Evaluate()

		// No assertions needed, just verifying it doesn't panic
	})

	t.Run("UnsortedGroup", func(t *testing.T) {
		g, _ := newTestGroup()

		// Create test rules with different group indices
		rule1 := &ngmodels.AlertRule{
			ID:             1,
			OrgID:          1,
			Title:          "Test Rule 1",
			UID:            "test-rule-1",
			RuleGroupIndex: 2, // Higher index
			Version:        1,
		}

		rule2 := &ngmodels.AlertRule{
			ID:             2,
			OrgID:          1,
			Title:          "Test Rule 2",
			UID:            "test-rule-2",
			RuleGroupIndex: 1, // Lower index
			Version:        1,
		}

		// Track evaluation order
		evalOrder := make([]string, 0, 2)

		// Create fake rules with evaluation handlers
		fakeRule1 := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				evalOrder = append(evalOrder, rule1.UID)
				return true, nil
			},
		}

		fakeRule2 := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				evalOrder = append(evalOrder, rule2.UID)
				return true, nil
			},
		}

		// Add rules in reverse order
		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule1,
			Evaluation: Evaluation{
				rule:        rule1,
				scheduledAt: time.Now(),
			},
		})

		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule2,
			Evaluation: Evaluation{
				rule:        rule2,
				scheduledAt: time.Now(),
			},
		})

		// Evaluate the group (should sort first)
		g.Evaluate()

		// Verify the rules were sorted and evaluated in the correct order
		assert.True(t, g.sorted)
		require.Len(t, evalOrder, 2)
		assert.Equal(t, rule2.UID, evalOrder[0]) // Lower index should be first
		assert.Equal(t, rule1.UID, evalOrder[1]) // Higher index should be second
	})
}

// TestGroupSequentialEvaluation tests the sequential evaluation behavior of a Group
func TestGroupSequentialEvaluation(t *testing.T) {
	t.Run("SequentialExecution", func(t *testing.T) {
		g, metrics := newTestGroup()

		// Create test rules
		rule1 := &ngmodels.AlertRule{
			ID:             1,
			OrgID:          1,
			Title:          "Test Rule 1",
			UID:            "test-rule-1",
			RuleGroupIndex: 1,
			Version:        1,
		}

		rule2 := &ngmodels.AlertRule{
			ID:             2,
			OrgID:          1,
			Title:          "Test Rule 2",
			UID:            "test-rule-2",
			RuleGroupIndex: 2,
			Version:        1,
		}

		// Create synchronization channels
		rule1Started := make(chan struct{})
		rule1Done := make(chan struct{})
		rule2Started := make(chan struct{})

		// Create fake rules with evaluation handlers
		fakeRule1 := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				// Signal that rule1 has started evaluation
				close(rule1Started)

				// Wait for the test to signal completion
				<-rule1Done

				return true, nil
			},
		}

		fakeRule2 := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				// Signal that rule2 has started evaluation
				close(rule2Started)
				return true, nil
			},
		}

		// Add rules to the group
		now := time.Now()
		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule1,
			Evaluation: Evaluation{
				rule:        rule1,
				scheduledAt: now,
			},
		})

		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule2,
			Evaluation: Evaluation{
				rule:        rule2,
				scheduledAt: now,
			},
		})

		// Sort the rules
		g.Sort()

		// Start evaluating the group in a goroutine
		go g.evaluateSequentially()

		// Wait for rule1 to start evaluating
		select {
		case <-rule1Started:
			// This is expected
		case <-time.After(time.Second):
			t.Fatal("Rule 1 didn't start evaluating")
		}

		// Verify rule2 hasn't started yet (should be blocked by rule1)
		select {
		case <-rule2Started:
			t.Fatal("Rule 2 started before Rule 1 completed")
		default:
			// This is expected
		}

		// Complete rule1 evaluation by closing the done channel
		// (we don't need to call rule1EvalCallback anymore since it's handled automatically)
		close(rule1Done)

		// Wait for rule2 to start
		select {
		case <-rule2Started:
			// This is expected
		case <-time.After(time.Second):
			t.Fatal("Rule 2 didn't start after Rule 1 completed")
		}

		// Verify metrics is used (to satisfy linter)
		assert.NotNil(t, metrics)
	})

	t.Run("RuleEvalFails", func(t *testing.T) {
		g, metrics := newTestGroup()

		// Create test rule
		rule := &ngmodels.AlertRule{
			ID:             1,
			OrgID:          1,
			Title:          "Test Rule",
			UID:            "test-rule",
			RuleGroupIndex: 1,
			Version:        1,
		}

		evalCalled := false

		// Create fake rule with evaluation handler
		fakeRule := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				evalCalled = true
				return false, nil // Simulate failure
			},
		}

		// Add rule to the group
		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule,
			Evaluation: Evaluation{
				rule:        rule,
				scheduledAt: time.Now(),
			},
		})

		// Evaluate the group
		g.evaluateSequentially()

		// Verify the rule was evaluated
		assert.True(t, evalCalled)

		// Verify metrics is used (to satisfy linter)
		assert.NotNil(t, metrics)
	})

	t.Run("DroppedEvaluation", func(t *testing.T) {
		// Create a new registry to track metrics
		registry := prometheus.NewRegistry()
		m := metrics.NewSchedulerMetrics(registry)
		g := NewGroup(log.NewNopLogger(), m)

		// Create test rule
		rule := &ngmodels.AlertRule{
			ID:             1,
			OrgID:          1,
			Title:          "Test Rule",
			UID:            "test-rule",
			RuleGroupIndex: 1,
			Version:        1,
		}

		now := time.Now()
		droppedTime := now.Add(-time.Minute)

		// Create a fake rule that will return a dropped evaluation
		fakeRule := &FakeRule{
			EvalFn: func(eval *Evaluation) (bool, *Evaluation) {
				// Return success=true and a dropped evaluation
				droppedEval := &Evaluation{
					rule:        rule,
					scheduledAt: droppedTime,
				}
				return true, droppedEval
			},
		}

		// Add rule to the group
		g.AddRule(readyToRunItem{
			ruleRoutine: fakeRule,
			Evaluation: Evaluation{
				rule:        rule,
				scheduledAt: now,
			},
		})

		// Verify no metrics before evaluation
		expectedMetric := ""
		err := testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetric), "grafana_alerting_schedule_rule_evaluations_missed_total")
		require.NoError(t, err, "Expected no metrics before evaluation")

		// Evaluate the group
		g.evaluateSequentially()

		// Define the expected metric output after evaluation
		expectedMetric = fmt.Sprintf(
			`# HELP grafana_alerting_schedule_rule_evaluations_missed_total The total number of rule evaluations missed due to a slow rule evaluation.
# TYPE grafana_alerting_schedule_rule_evaluations_missed_total counter
grafana_alerting_schedule_rule_evaluations_missed_total{name="%s",org="%d"} 1
`, rule.Title, rule.OrgID)

		// Verify the metric was incremented with the correct labels
		err = testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetric), "grafana_alerting_schedule_rule_evaluations_missed_total")
		require.NoError(t, err, "Metrics should match expected output")
	})
}
