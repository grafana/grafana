// LOGZ.IO GRAFANA CHANGE :: APPZ-3027: Replace per-rule_uid metric labels with bounded top-N offender reporting.
//
// Per-rule latency histograms cost one metric child per rule UID that is never
// released when a rule is deleted, which dominated the /metrics payload while
// still not recording the number that actually matters: how many results a
// single evaluation produced. This reports the heaviest evaluations to the log
// instead, at a cost bounded by the number of rules rather than by the number of
// evaluations.
package schedule

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// offenderReportInterval is how often the heaviest evaluations are logged.
	// Draining on this interval doubles as the expiry for tracked samples, so
	// there is no TTL to configure.
	//
	// The window has to be wide enough that a rule lands in most of them. The
	// heaviest rules take minutes to process and so self-throttle to roughly one
	// evaluation per 15 minutes, which would leave them absent from many windows if
	// the interval were shorter.
	offenderReportInterval = 15 * time.Minute

	// offenderReportSize is how many rules are reported per dimension. The top 100
	// rules account for ~40% of all evaluation cost, against ~20% for the top 12,
	// so a larger report shows the shape of the distribution and surfaces a new
	// offender before it reaches the very top.
	offenderReportSize = 100
)

// sample is the cost of one rule evaluation.
type sample struct {
	ruleUID     string
	orgID       int64
	results     int
	transitions int
	evalDur     time.Duration
	procDur     time.Duration
}

// offender accumulates every evaluation of one rule within the current window.
//
// Both the max and the sum are kept for each dimension because they answer
// different questions. The max is the worst single evaluation, so it is the risk
// of running out of memory. The sum is rate times cost, so it is the rule's share
// of total capacity. Averages are sum/count and are left to the reader.
type offender struct {
	ruleUID string
	orgID   int64
	count   int64

	maxResults, sumResults int64
	maxTransitions         int64
	maxProcDur, sumProcDur time.Duration
	maxEvalDur, sumEvalDur time.Duration
}

func (o *offender) merge(s sample) {
	o.count++

	if int64(s.results) > o.maxResults {
		o.maxResults = int64(s.results)
	}
	o.sumResults += int64(s.results)

	if int64(s.transitions) > o.maxTransitions {
		o.maxTransitions = int64(s.transitions)
	}

	if s.procDur > o.maxProcDur {
		o.maxProcDur = s.procDur
	}
	o.sumProcDur += s.procDur

	if s.evalDur > o.maxEvalDur {
		o.maxEvalDur = s.evalDur
	}
	o.sumEvalDur += s.evalDur
}

// dimension is one axis a rule can be reported for. A rule is reported if it
// places on any dimension, so a rule that is extreme in only one way is not
// hidden by rules that are moderately bad in every way.
type dimension struct {
	name  string
	worse func(a, b *offender) bool
}

// reportDimensions are the axes rules are ranked on.
//
// results uses the max because one huge evaluation is what exhausts memory, even
// if the rule is usually small. The two durations use the sum because sustained
// cost is what decides which rule to fix first.
//
// Query time is ranked separately from processing time because they are different
// problems: query time is mostly the datasource's latency and is capped by
// evaluation_timeout, while processing time has no ceiling and is where both the
// results and the states built from them are held in memory at once.
var reportDimensions = []dimension{
	{"results", func(a, b *offender) bool { return a.maxResults > b.maxResults }},
	{"process_time", func(a, b *offender) bool { return a.sumProcDur > b.sumProcDur }},
	{"query_time", func(a, b *offender) bool { return a.sumEvalDur > b.sumEvalDur }},
}

// offenderTracker accumulates per-rule cost for the current window.
//
// Keying by rule UID means a rule appears once no matter how often it evaluates,
// memory is bounded by the number of rules rather than the number of
// evaluations, and sorting happens once per drain instead of on every sample.
type offenderTracker struct {
	mu    sync.Mutex
	rules map[string]*offender
	seen  int64
}

func newOffenderTracker() *offenderTracker {
	return &offenderTracker{rules: make(map[string]*offender)}
}

func (t *offenderTracker) observe(s sample) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.seen++
	o, ok := t.rules[s.ruleUID]
	if !ok {
		o = &offender{ruleUID: s.ruleUID, orgID: s.orgID}
		t.rules[s.ruleUID] = o
	}
	o.merge(s)
}

// drain returns every rule seen and the total evaluation count, then starts a new
// window.
func (t *offenderTracker) drain() ([]*offender, int64) {
	t.mu.Lock()
	all, seen := t.rules, t.seen
	t.rules, t.seen = make(map[string]*offender, len(all)), 0
	t.mu.Unlock()

	out := make([]*offender, 0, len(all))
	for _, o := range all {
		out = append(out, o)
	}
	return out, seen
}

// offenderReporter periodically logs the heaviest rule evaluations.
type offenderReporter struct {
	tracker  *offenderTracker
	size     int
	interval time.Duration
	log      log.Logger
}

func newOffenderReporter(logger log.Logger, size int, interval time.Duration) *offenderReporter {
	return &offenderReporter{
		tracker:  newOffenderTracker(),
		size:     size,
		interval: interval,
		log:      logger,
	}
}

func (r *offenderReporter) observe(s sample) {
	if r == nil {
		return
	}
	r.tracker.observe(s)
}

func (r *offenderReporter) run(ctx context.Context, c clock.Clock) {
	if r == nil || r.interval <= 0 {
		return
	}
	t := c.Ticker(r.interval)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.report()
		}
	}
}

// rank returns each reported rule and its position on every dimension it placed
// on. A missing entry means the rule did not place on that dimension.
func (r *offenderReporter) rank(all []*offender) map[string]map[string]int {
	ranks := make(map[string]map[string]int)

	for _, d := range reportDimensions {
		sort.Slice(all, func(i, j int) bool { return d.worse(all[i], all[j]) })

		n := r.size
		if len(all) < n {
			n = len(all)
		}
		for i := 0; i < n; i++ {
			uid := all[i].ruleUID
			if ranks[uid] == nil {
				ranks[uid] = make(map[string]int, len(reportDimensions))
			}
			ranks[uid][d.name] = i + 1
		}
	}

	return ranks
}

// report logs the current window's heaviest evaluations and starts a new window.
func (r *offenderReporter) report() {
	if r == nil {
		return
	}

	all, seen := r.tracker.drain()
	if seen == 0 || len(all) == 0 {
		return
	}

	ranks := r.rank(all)

	reported := make([]*offender, 0, len(ranks))
	for _, o := range all {
		if _, ok := ranks[o.ruleUID]; ok {
			reported = append(reported, o)
		}
	}

	// Order by the rule's best position across dimensions so the worst offenders
	// appear first, and break ties by UID so output is deterministic.
	best := func(o *offender) int {
		b := r.size + 1
		for _, rank := range ranks[o.ruleUID] {
			if rank < b {
				b = rank
			}
		}
		return b
	}
	sort.Slice(reported, func(i, j int) bool {
		bi, bj := best(reported[i]), best(reported[j])
		if bi != bj {
			return bi < bj
		}
		return reported[i].ruleUID < reported[j].ruleUID
	})

	r.log.Info("Alert rule evaluation offenders",
		"window", r.interval,
		"evaluations", seen,
		"rules_evaluated", len(all),
		"rules_reported", len(reported),
		"top_n", r.size)

	for _, o := range reported {
		rank := ranks[o.ruleUID]
		r.log.Info("Alert rule offender",
			"rule_uid", o.ruleUID,
			"org_id", o.orgID,
			"evaluations", o.count,
			"max_results", o.maxResults,
			"sum_results", o.sumResults,
			"max_transitions", o.maxTransitions,
			"max_process_ms", o.maxProcDur.Milliseconds(),
			"sum_process_ms", o.sumProcDur.Milliseconds(),
			"max_query_ms", o.maxEvalDur.Milliseconds(),
			"sum_query_ms", o.sumEvalDur.Milliseconds(),
			"rank_results", rank["results"],
			"rank_process_time", rank["process_time"],
			"rank_query_time", rank["query_time"],
			"window_evaluations", seen)
	}
}

// LOGZ.IO GRAFANA CHANGE :: End
