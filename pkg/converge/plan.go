package converge

import (
	"fmt"
	"strings"
)

// Mode records how a plan was derived.
type Mode uint8

const (
	// ModeFull means the inputs described every key on both sides.
	ModeFull Mode = iota
	// ModeHinted means planning was narrowed to a hint closure.
	ModeHinted
)

func (m Mode) String() string {
	if m == ModeHinted {
		return "hinted"
	}
	return "full"
}

// ExclusionScope records what a plan claims about the source.
type ExclusionScope uint8

const (
	// ScopeConvergent means the plan claims to converge the whole source, so
	// its exclusion set is complete. Bulk reconciliation uses this.
	ScopeConvergent ExclusionScope = iota

	// ScopeTargeted means the plan mutates a named subset and makes no claim
	// about the rest of the source, so it reports only the exclusions inside
	// its hint closure. Interactive single-key writes use this.
	//
	// ScopeTargeted is not a weakened ScopeConvergent: a plan that never
	// claimed to have surveyed the source is being honest, not lossy. Using it
	// for a run whose purpose is convergence silently drops the guarantee that
	// every exclusion is re-stated.
	ScopeTargeted
)

func (s ExclusionScope) String() string {
	if s == ScopeTargeted {
		return "targeted"
	}
	return "convergent"
}

// Exclusion is a declared entity the target will not hold, and why.
//
// Exclusions are re-stated on every run rather than announced once, because a
// user who cannot see the reason their dashboard is missing cannot act on it.
type Exclusion struct {
	Key    Key
	Reason Reason

	// Removed reports whether this plan deletes an entity the target currently
	// holds at this key — that is, whether the exclusion is destructive now
	// rather than merely preventing a write.
	Removed bool
}

// Plan is the complete, ordered description of how to make the target match
// the source. It is a value: inspectable, serialisable, comparable, and safe
// to show a user before any of it runs.
//
// A plan is derived from one observation of the target and is not durable.
// Persisting one and replaying it later is unsound: the inventory it was
// computed against may have moved. Re-plan instead; planning is cheap.
type Plan struct {
	// Ops is every operation in a dependency-safe total order. Executing them
	// in order never violates an ordering invariant.
	Ops []Op

	// Stages partitions Ops into dependency-free batches. Every operation in a
	// stage may run concurrently with the others; stage i+1 must not begin
	// until stage i has finished. Concatenating the stages yields Ops.
	Stages [][]Op

	// Exclusions lists declared entities the target will not hold, sorted by
	// key. Complete when Scope is [ScopeConvergent].
	Exclusions []Exclusion

	// Rejected lists entities a budget would not admit, sorted by key. They are
	// reported exactly like exclusions and re-stated on every run.
	Rejected []Exclusion

	Mode  Mode
	Scope ExclusionScope
}

// Empty reports whether the plan changes nothing.
func (p *Plan) Empty() bool { return len(p.Ops) == 0 }

// Op returns the operation with the given reference.
func (p *Plan) Op(ref OpRef) (Op, bool) {
	for _, o := range p.Ops {
		if o.Ref() == ref {
			return o, true
		}
	}
	return Op{}, false
}

// Counts returns the number of operations of each kind.
func (p *Plan) Counts() map[OpKind]int {
	out := make(map[OpKind]int, 6)
	for _, o := range p.Ops {
		out[o.Kind]++
	}
	return out
}

// String renders the plan for logs and previews. The format is stable enough
// to diff two plans in a test but is not a serialisation format.
func (p *Plan) String() string {
	var b strings.Builder
	fmt.Fprintf(&b, "plan mode=%s scope=%s ops=%d stages=%d exclusions=%d rejected=%d\n",
		p.Mode, p.Scope, len(p.Ops), len(p.Stages), len(p.Exclusions), len(p.Rejected))
	for i, stage := range p.Stages {
		fmt.Fprintf(&b, "  stage %d:\n", i)
		for _, o := range stage {
			fmt.Fprintf(&b, "    %s %s", o.Kind, o.Key)
			if o.From != "" {
				fmt.Fprintf(&b, " (from %s)", o.From)
			}
			if o.Identity != "" {
				fmt.Fprintf(&b, " id=%s", o.Identity)
			}
			if o.Reason != "" {
				fmt.Fprintf(&b, " reason=%s", o.Reason)
			}
			b.WriteByte('\n')
		}
	}
	for _, e := range p.Exclusions {
		fmt.Fprintf(&b, "  excluded %s reason=%s removed=%t\n", e.Key, e.Reason, e.Removed)
	}
	for _, e := range p.Rejected {
		fmt.Fprintf(&b, "  rejected %s reason=%s removed=%t\n", e.Key, e.Reason, e.Removed)
	}
	return b.String()
}

// Order derives the safe execution order for operations a caller built itself,
// returning a plan with the same stage and dependency guarantees [NewPlan]
// gives.
//
// It exists for consumers that already compute their own diff and want only
// the ordering: the invariants that stop a container being removed out from
// under its contents, or an entity being written into one that does not exist
// yet. Everything the ordering needs must be on the operations — in
// particular [Op.Container], which is what places an operation inside a
// container.
//
// Prefer [NewPlan]. A caller that diffs for itself keeps the part of the
// problem where the bugs are.
func Order(ops []Op, mode Mode, scope ExclusionScope) (*Plan, error) {
	p := &Plan{Mode: mode, Scope: scope}
	if err := order(p, ops, false); err != nil {
		return nil, err
	}
	return p, nil
}
