// LOGZ.IO GRAFANA CHANGE :: APPZ-3027: Tests for bounded top-N offender reporting.
package schedule

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOffender_MergeKeepsMaxAndSum(t *testing.T) {
	tr := newOffenderTracker()

	tr.observe(sample{ruleUID: "a", orgID: 7, results: 10, transitions: 2, evalDur: time.Second, procDur: 2 * time.Second})
	tr.observe(sample{ruleUID: "a", orgID: 7, results: 900, transitions: 5, evalDur: 3 * time.Second, procDur: time.Second})
	tr.observe(sample{ruleUID: "a", orgID: 7, results: 50, transitions: 1, evalDur: time.Second, procDur: time.Second})

	all, seen := tr.drain()
	require.Len(t, all, 1, "one rule occupies one slot no matter how often it evaluates")
	assert.EqualValues(t, 3, seen)

	o := all[0]
	assert.EqualValues(t, 7, o.orgID)
	assert.EqualValues(t, 3, o.count)
	assert.EqualValues(t, 900, o.maxResults)
	assert.EqualValues(t, 960, o.sumResults)
	assert.EqualValues(t, 5, o.maxTransitions)
	assert.Equal(t, 2*time.Second, o.maxProcDur)
	assert.Equal(t, 4*time.Second, o.sumProcDur)
	assert.Equal(t, 3*time.Second, o.maxEvalDur)
	assert.Equal(t, 5*time.Second, o.sumEvalDur)
}

func TestOffenderReporter_RankIsExactRegardlessOfArrivalOrder(t *testing.T) {
	// Ascending arrival is what a threshold-based top-N slice gets wrong: early
	// small samples set the bar and later large ones get rejected.
	rank := func(order []int) map[string]map[string]int {
		r := newOffenderReporter(nil, 3, time.Minute)
		for _, i := range order {
			r.observe(sample{ruleUID: fmt.Sprintf("rule-%d", i), results: i, procDur: time.Duration(i) * time.Millisecond})
		}
		all, _ := r.tracker.drain()
		return r.rank(all)
	}

	asc := make([]int, 0, 500)
	for i := 1; i <= 500; i++ {
		asc = append(asc, i)
	}
	desc := make([]int, 0, 500)
	for i := 500; i >= 1; i-- {
		desc = append(desc, i)
	}

	for _, tc := range []struct {
		name  string
		order []int
	}{{"ascending", asc}, {"descending", desc}} {
		t.Run(tc.name, func(t *testing.T) {
			got := rank(tc.order)
			require.Len(t, got, 3, "only the top 3 place")
			assert.Equal(t, 1, got["rule-500"]["results"])
			assert.Equal(t, 2, got["rule-499"]["results"])
			assert.Equal(t, 3, got["rule-498"]["results"])
		})
	}
}

func TestOffenderReporter_ReportsRuleThatPlacesOnAnySingleDimension(t *testing.T) {
	r := newOffenderReporter(nil, 1, time.Minute)

	// Three rules, each extreme on exactly one dimension. With a top-1 per
	// dimension all three must be reported, each ranked 1 on its own axis only.
	r.observe(sample{ruleUID: "wide", results: 900_000, procDur: time.Millisecond, evalDur: time.Millisecond})
	r.observe(sample{ruleUID: "slow-process", results: 1, procDur: 11 * time.Minute, evalDur: time.Millisecond})
	r.observe(sample{ruleUID: "slow-query", results: 1, procDur: time.Millisecond, evalDur: 30 * time.Second})

	all, seen := r.tracker.drain()
	require.EqualValues(t, 3, seen)
	ranks := r.rank(all)

	require.Len(t, ranks, 3)
	assert.Equal(t, 1, ranks["wide"]["results"])
	assert.Zero(t, ranks["wide"]["process_time"], "did not place on process time")

	assert.Equal(t, 1, ranks["slow-process"]["process_time"])
	assert.Zero(t, ranks["slow-process"]["results"])

	assert.Equal(t, 1, ranks["slow-query"]["query_time"])
	assert.Zero(t, ranks["slow-query"]["results"])
}

func TestOffenderReporter_RanksResultsByMaxAndDurationsBySum(t *testing.T) {
	r := newOffenderReporter(nil, 1, time.Minute)

	// "spiky" has the single worst evaluation. "steady" has the larger total.
	// Results rank on the max, so spiky wins. Durations rank on the sum, so
	// steady wins. A rule extreme on one axis must not mask the other.
	r.observe(sample{ruleUID: "spiky", results: 1_000, procDur: 10 * time.Second})
	for i := 0; i < 50; i++ {
		r.observe(sample{ruleUID: "steady", results: 100, procDur: time.Second})
	}

	all, _ := r.tracker.drain()
	ranks := r.rank(all)

	assert.Equal(t, 1, ranks["spiky"]["results"], "max results: 1000 > 100")
	assert.Equal(t, 1, ranks["steady"]["process_time"], "sum process: 50s > 10s")
}

func TestOffenderTracker_DrainResetsWindow(t *testing.T) {
	tr := newOffenderTracker()
	tr.observe(sample{ruleUID: "a", results: 42})

	all, seen := tr.drain()
	require.Len(t, all, 1)
	require.EqualValues(t, 1, seen)

	// The drain interval is the only expiry mechanism, so nothing may survive it.
	all, seen = tr.drain()
	assert.Empty(t, all)
	assert.EqualValues(t, 0, seen)
}

func TestOffenderReporter_NilIsSafe(t *testing.T) {
	// schedule structs built directly in tests leave the reporter nil.
	var r *offenderReporter
	assert.NotPanics(t, func() {
		r.observe(sample{ruleUID: "a", results: 1})
		r.report()
	})
}

func TestOffenderReporter_ReportEmptyWindowDoesNotTouchLogger(t *testing.T) {
	// A window with no evaluations must return before using the nil logger.
	r := newOffenderReporter(nil, 10, time.Minute)
	assert.NotPanics(t, r.report)
}

// LOGZ.IO GRAFANA CHANGE :: End
