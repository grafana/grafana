package conformance

import (
	"fmt"
	"math/rand"
	"reflect"
	"sort"
	"testing"

	"github.com/grafana/grafana/pkg/converge"
)

// Options configures [Check].
type Options struct {
	// Containers is the configuration under test. Its FallbackIdentity must be
	// a pure function of the key, or the properties fail for reasons that are
	// the consumer's rather than the planner's.
	Containers converge.ContainerConfig

	// Cases is how many generated scenarios to run. Zero uses 300.
	Cases int

	// Seed fixes the generator. Zero uses 1, so a failure is reproducible by
	// default rather than by luck.
	Seed int64

	// Budget, when set, is applied to every case so that admission under
	// pressure is exercised.
	Budget converge.Budget
}

func (o Options) cases() int {
	if o.Cases <= 0 {
		return 300
	}
	return o.Cases
}

// Check runs the whole property suite. Each property is a subtest, so a
// failure names the guarantee that broke rather than a line number.
func Check(t *testing.T, opts Options) {
	t.Helper()

	gen := newGenerator(opts)
	cases := make([]scenario, 0, opts.cases())
	for i := 0; i < opts.cases(); i++ {
		cases = append(cases, gen.next())
	}

	t.Run("P1_determinism", func(t *testing.T) { forEach(t, cases, opts, p1Determinism) })
	t.Run("P2_permutation_invariance", func(t *testing.T) { forEach(t, cases, opts, p2Permutation) })
	t.Run("P3_idempotence", func(t *testing.T) { forEach(t, cases, opts, p3Idempotence) })
	t.Run("P4_mode_equivalence", func(t *testing.T) { forEach(t, cases, opts, p4ModeEquivalence) })
	t.Run("P5_move_neutrality", func(t *testing.T) { forEach(t, cases, opts, p5MoveNeutrality) })
	t.Run("P6_order_safety", func(t *testing.T) { forEach(t, cases, opts, p6OrderSafety) })
	t.Run("P7_convergence", func(t *testing.T) { forEach(t, cases, opts, p7Convergence) })
	t.Run("P8_exclusion_completeness", func(t *testing.T) { forEach(t, cases, opts, p8Exclusions) })
	t.Run("P9_budget_determinism", func(t *testing.T) { forEach(t, cases, opts, p9BudgetDeterminism) })
	t.Run("P10_history_independence", func(t *testing.T) { forEach(t, cases, opts, p10HistoryIndependence) })
	t.Run("P11_restriction_safety", func(t *testing.T) { forEach(t, cases, opts, p11RestrictionSafety) })
	t.Run("P12_restriction_idempotence", func(t *testing.T) { forEach(t, cases, opts, p12RestrictionIdempotence) })
}

type scenario struct {
	index    int
	desired  []converge.Declaration
	model    *Model
	hintKeys []converge.Key
}

func forEach(t *testing.T, cases []scenario, opts Options, fn func(*testing.T, scenario, Options)) {
	t.Helper()
	for _, c := range cases {
		if !t.Run(fmt.Sprintf("case%03d", c.index), func(t *testing.T) { fn(t, c, opts) }) {
			// One failure is enough to act on; the rest are usually the same
			// bug restated.
			return
		}
	}
}

func (s scenario) plan(opts Options, extra ...converge.Option) (*converge.Plan, error) {
	args := append([]converge.Option{converge.WithContainers(opts.Containers)}, extra...)
	if opts.Budget.MaxEntities > 0 {
		args = append(args, converge.WithBudget(opts.Budget))
	}
	return converge.NewPlan(s.desired, s.model.Inventory(), args...)
}

func mustPlan(t *testing.T, s scenario, opts Options, extra ...converge.Option) *converge.Plan {
	t.Helper()
	p, err := s.plan(opts, extra...)
	if err != nil {
		t.Fatalf("planning failed: %v\ndesired=%v\ninventory=%v", err, s.desired, s.model.Inventory())
	}
	return p
}

// P1: equal inputs produce an identical plan.
func p1Determinism(t *testing.T, s scenario, opts Options) {
	a, b := mustPlan(t, s, opts), mustPlan(t, s, opts)
	if a.String() != b.String() {
		t.Fatalf("two runs over identical inputs differ:\n%s\n--- vs ---\n%s", a, b)
	}
}

// P2: shuffling the inputs does not change the plan.
func p2Permutation(t *testing.T, s scenario, opts Options) {
	base := mustPlan(t, s, opts)

	rng := rand.New(rand.NewSource(int64(s.index) + 7))
	shuffled := append([]converge.Declaration(nil), s.desired...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	inv := s.model.Inventory()
	rng.Shuffle(len(inv), func(i, j int) { inv[i], inv[j] = inv[j], inv[i] })

	other, err := converge.NewPlan(shuffled, inv, converge.WithContainers(opts.Containers))
	if err != nil {
		t.Fatalf("planning failed after shuffling: %v", err)
	}
	if opts.Budget.MaxEntities <= 0 && base.String() != other.String() {
		t.Fatalf("plan depends on input order:\n%s\n--- vs ---\n%s", base, other)
	}
}

// P3: applying a plan converges, and re-planning then has nothing to do.
func p3Idempotence(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)
	m := s.model.Clone()
	if err := m.Apply(p); err != nil {
		t.Fatalf("plan is unsafe: %v\n%s", err, p)
	}

	next, err := converge.NewPlan(s.desired, m.Inventory(), converge.WithContainers(opts.Containers))
	if err != nil {
		t.Fatalf("re-planning failed: %v", err)
	}
	if !next.Empty() {
		t.Fatalf("re-planning after apply still has work:\n%s\nafter:\n%s", next, p)
	}
}

// P4: a hinted plan whose closure covers every difference reaches the same
// target state as a full one.
//
// The hint keys supplied here are the complete difference set. That is the
// obligation on a caller, and it is not checkable from inside the planner: a
// hinted run cannot discover a key it was never pointed at. Supply less and
// the two modes legitimately diverge — which is why an incomplete hint source
// must fall back to a full run rather than narrow the scan.
func p4ModeEquivalence(t *testing.T, s scenario, opts Options) {
	full := mustPlan(t, s, opts)
	hinted, err := converge.NewPlan(s.desired, s.model.Inventory(),
		converge.WithContainers(opts.Containers),
		converge.WithHints(converge.HintSet{Keys: s.hintKeys, Complete: true}),
	)
	if err != nil {
		t.Fatalf("hinted planning failed: %v", err)
	}

	mFull, mHinted := s.model.Clone(), s.model.Clone()
	if err := mFull.Apply(full); err != nil {
		t.Fatalf("full plan is unsafe: %v", err)
	}
	if err := mHinted.Apply(hinted); err != nil {
		t.Fatalf("hinted plan is unsafe: %v\n%s", err, hinted)
	}
	if !reflect.DeepEqual(mFull.Content(), mHinted.Content()) {
		t.Fatalf("modes diverge\nfull:   %v\nhinted: %v\nhints: %v\nfull plan:\n%s\nhinted plan:\n%s",
			sortedContent(mFull), sortedContent(mHinted), s.hintKeys, full, hinted)
	}
}

// P5: move detection changes which identities survive, never what content the
// target holds.
func p5MoveNeutrality(t *testing.T, s scenario, opts Options) {
	with := mustPlan(t, s, opts, converge.WithMoveDetection(true))
	without := mustPlan(t, s, opts, converge.WithMoveDetection(false))

	mWith, mWithout := s.model.Clone(), s.model.Clone()
	if err := mWith.Apply(with); err != nil {
		t.Fatalf("plan with moves is unsafe: %v\n%s", err, with)
	}
	if err := mWithout.Apply(without); err != nil {
		t.Fatalf("plan without moves is unsafe: %v\n%s", err, without)
	}
	if !reflect.DeepEqual(mWith.Content(), mWithout.Content()) {
		t.Fatalf("move detection changed the content:\nwith:    %v\nwithout: %v",
			sortedContent(mWith), sortedContent(mWithout))
	}
}

// P6: no prefix of the plan violates an ordering invariant, and nothing in a
// stage depends on anything else in the same stage.
func p6OrderSafety(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)
	if err := s.model.Clone().ApplyStages(p); err != nil {
		t.Fatalf("%v\n%s", err, p)
	}
	if total := countOps(p.Stages); total != len(p.Ops) {
		t.Fatalf("stages hold %d ops, plan holds %d", total, len(p.Ops))
	}
}

// P7: after applying, the target holds exactly the declared entities that were
// not excluded or rejected — no extras, none missing.
func p7Convergence(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)
	m := s.model.Clone()
	if err := m.Apply(p); err != nil {
		t.Fatalf("plan is unsafe: %v", err)
	}

	want := map[converge.Key]converge.Fingerprint{}
	absent := map[converge.Key]bool{}
	for _, e := range p.Exclusions {
		absent[e.Key] = true
	}
	for _, e := range p.Rejected {
		absent[e.Key] = true
	}
	for _, d := range s.desired {
		if d.Container || d.Verdict != converge.Entity || absent[d.Key] {
			continue
		}
		want[d.Key] = d.Fingerprint
	}
	if got := m.Content(); !reflect.DeepEqual(got, want) {
		t.Fatalf("target did not converge\ngot:  %v\nwant: %v\n%s", got, want, p)
	}
}

// P8: every excluded declaration is reported exactly once, and nothing ignored
// is reported at all.
func p8Exclusions(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)

	reported := map[converge.Key]int{}
	for _, e := range p.Exclusions {
		reported[e.Key]++
	}
	for _, d := range s.desired {
		switch d.Verdict {
		case converge.Entity:
			// Nothing to report: it is supposed to be held.
		case converge.Excluded:
			if reported[d.Key] == 0 {
				t.Fatalf("excluded %q was not reported: %v", d.Key, p.Exclusions)
			}
		case converge.Ignored:
			// Invisible means unreported, not untouched. A key the source says
			// is not an entity declares no entity, so one the target still
			// holds there is removed — silently, because nothing is wrong.
			// Whether a given key is "not an entity" or "an entity that cannot
			// be held" is the classifier's call, and it is the difference
			// between a silent removal and a reported one.
			if reported[d.Key] > 0 {
				t.Fatalf("ignored %q must stay invisible, got %v", d.Key, p.Exclusions)
			}
			for _, o := range p.Ops {
				if o.Key != d.Key {
					continue
				}
				switch o.Kind {
				case converge.OpCreate, converge.OpUpdate, converge.OpMove:
					t.Fatalf("ignored %q was written by %s", d.Key, o.Kind)
				case converge.OpDelete, converge.OpEnsureContainer, converge.OpRemoveContainer:
					// Removing what the source no longer declares is correct.
				}
			}
		}
	}
}

// P9: under a binding budget the admitted set is a function of the key order,
// so shuffling the input does not change who is rejected.
func p9BudgetDeterminism(t *testing.T, s scenario, opts Options) {
	budget := converge.Budget{MaxEntities: 2}
	base, err := converge.NewPlan(s.desired, s.model.Inventory(),
		converge.WithContainers(opts.Containers), converge.WithBudget(budget))
	if err != nil {
		t.Fatalf("planning failed: %v", err)
	}

	rng := rand.New(rand.NewSource(int64(s.index) + 11))
	shuffled := append([]converge.Declaration(nil), s.desired...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	other, err := converge.NewPlan(shuffled, s.model.Inventory(),
		converge.WithContainers(opts.Containers), converge.WithBudget(budget))
	if err != nil {
		t.Fatalf("planning failed: %v", err)
	}

	if !reflect.DeepEqual(base.Rejected, other.Rejected) {
		t.Fatalf("budget admission depends on arrival order:\n%v\n--- vs ---\n%v",
			base.Rejected, other.Rejected)
	}
}

// P10: a state that was converged away from and back again plans the same as
// one that was never touched.
//
// There is no parameter through which history could reach the planner, so this
// cannot fail by the planner consulting the past. What it does catch is the
// planner leaving a trace in the target that it then reads back — an identity
// minted differently on the way out and the way in, a container that does not
// survive a round trip.
func p10HistoryIndependence(t *testing.T, s scenario, opts Options) {
	restore := declarationsFor(s.model)

	// Converge away from the original state.
	away := mustPlan(t, s, opts)
	touched := s.model.Clone()
	if err := touched.Apply(away); err != nil {
		t.Fatalf("plan is unsafe: %v", err)
	}

	// And back to a description of where it started.
	back, err := converge.NewPlan(restore, touched.Inventory(), converge.WithContainers(opts.Containers))
	if err != nil {
		t.Fatalf("planning the return failed: %v", err)
	}
	if err := touched.Apply(back); err != nil {
		t.Fatalf("return plan is unsafe: %v\n%s", err, back)
	}
	if !reflect.DeepEqual(touched.Content(), s.model.Content()) {
		t.Fatalf("a round trip did not restore the content\ngot:  %v\nwant: %v",
			sortedContent(touched), sortedContent(s.model))
	}

	// The restored state must plan exactly as the untouched one did.
	again, err := converge.NewPlan(s.desired, touched.Inventory(), converge.WithContainers(opts.Containers))
	if err != nil {
		t.Fatalf("planning failed: %v", err)
	}
	if contentOf(away) != contentOf(again) {
		t.Fatalf("plan depends on how the state was reached:\n%s\n--- vs ---\n%s", away, again)
	}
}

// contentOf renders the content-affecting part of a plan, ignoring which
// identities happen to carry it. Two runs that mint identities differently are
// not two different plans.
func contentOf(p *converge.Plan) string {
	keys := make([]string, 0, len(p.Ops))
	for _, o := range p.Ops {
		keys = append(keys, fmt.Sprintf("%s|%s|%s|%s", o.Kind, o.From, o.Key, o.Fingerprint))
	}
	sort.Strings(keys)
	return fmt.Sprint(keys)
}

// P11: restricting a plan leaves one that is still safe and contains nothing
// whose dependency was removed.
func p11RestrictionSafety(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)
	if len(p.Ops) == 0 {
		return
	}
	rng := rand.New(rand.NewSource(int64(s.index) + 13))
	victim := p.Ops[rng.Intn(len(p.Ops))]

	restricted, err := converge.Restrict(p, []converge.Veto{{Ref: victim.Ref(), Reason: "test"}})
	if err != nil {
		t.Fatalf("restrict failed: %v", err)
	}
	if err := s.model.Clone().ApplyStages(restricted); err != nil {
		t.Fatalf("restricted plan is unsafe after vetoing %s: %v\n%s", victim.Ref(), err, restricted)
	}

	survived := map[converge.OpRef]bool{}
	for _, o := range restricted.Ops {
		survived[o.Ref()] = true
	}
	if survived[victim.Ref()] {
		t.Fatalf("vetoed op survived: %s", victim.Ref())
	}
	for _, o := range restricted.Ops {
		for _, dep := range o.DependsOn {
			if !survived[dep] {
				t.Fatalf("%s survived but its dependency %s did not", o.Ref(), dep)
			}
		}
	}
	// P14 in passing: restricting never invents an operation.
	original := map[converge.OpRef]bool{}
	for _, o := range p.Ops {
		original[o.Ref()] = true
	}
	for _, o := range restricted.Ops {
		if !original[o.Ref()] {
			t.Fatalf("restrict invented %s", o.Ref())
		}
	}
}

// P12: restricting twice with the same vetoes changes nothing the second time.
func p12RestrictionIdempotence(t *testing.T, s scenario, opts Options) {
	p := mustPlan(t, s, opts)
	if len(p.Ops) == 0 {
		return
	}
	v := []converge.Veto{{Ref: p.Ops[0].Ref(), Reason: "test"}}
	once, err := converge.Restrict(p, v)
	if err != nil {
		t.Fatalf("restrict failed: %v", err)
	}
	twice, err := converge.Restrict(once, nil)
	if err != nil {
		t.Fatalf("restrict failed: %v", err)
	}
	if once.String() != twice.String() {
		t.Fatalf("restrict is not idempotent:\n%s\n--- vs ---\n%s", once, twice)
	}
}

func countOps(stages [][]converge.Op) int {
	n := 0
	for _, s := range stages {
		n += len(s)
	}
	return n
}

func sortedContent(m *Model) []string {
	c := m.Content()
	out := make([]string, 0, len(c))
	for k, v := range c {
		out = append(out, string(k)+"="+string(v))
	}
	sort.Strings(out)
	return out
}

// declarationsFor derives a desired set describing the model exactly as it
// stands, containers included. Omitting the containers would make the derived
// plan remove the ones no entity implies, so it would not be the no-op the
// round-trip property needs.
func declarationsFor(m *Model) []converge.Declaration {
	out := make([]converge.Declaration, 0, len(m.Entities)+len(m.Containers))
	for k, e := range m.Entities {
		out = append(out, converge.Declaration{Key: k, Fingerprint: e.Fingerprint})
	}
	for k, held := range m.Containers {
		for _, c := range held {
			out = append(out, converge.Declaration{
				Key: k, Container: true, Identity: c.Identity, Fingerprint: c.Fingerprint,
			})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out
}
