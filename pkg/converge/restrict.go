package converge

// Veto removes one operation from a plan.
//
// Vetoes are how authorisation, server dry-run, policy and human approval
// reach a plan without this package knowing what any of them are. A caller
// plans, inspects, decides, and hands back the operations it will not allow;
// everything about *why* stays on the caller's side of the boundary.
type Veto struct {
	Ref    OpRef
	Reason Reason
}

// Restrict removes vetoed operations and everything that depended on them,
// returning a plan that still satisfies every ordering invariant. The input
// plan is not modified.
//
// Dropping operations naively produces an incoherent plan: remove a container
// ensure but keep the writes into it, or keep a container removal whose
// contents were never emptied, and the result is unsafe. Restrict therefore
// propagates each veto to every operation that depended on it, to a fixpoint,
// and removes the remainder of any all-or-nothing group that loses a member.
//
// A vetoed relocation is dropped, never rewritten as a delete and a create: a
// caller that refused a move did not authorise a deletion.
//
// Three cautions apply to the caller, and none can be enforced from here:
//
//   - Veto the whole plan before executing any of it. Checking permissions or
//     dry-running operation by operation during application makes the target's
//     contents depend on execution order, and leaves no point at which the
//     intended effect existed as one reviewable object.
//   - Never persist a veto as a reason to skip next time. Every run decides
//     again, so that a permission granted later converges without anyone
//     having to remember that it was once denied.
//   - A transient failure is not a veto. A dry-run that fails validation is
//     permanent and belongs here; one that fails on a timeout or a 5xx means
//     planning should be abandoned, nothing vetoed, and the version position
//     held.
func Restrict(p *Plan, vetoes []Veto) (*Plan, error) {
	if len(vetoes) == 0 {
		return clonePlan(p), nil
	}

	// Each operation's reference is built once. Rebuilding it per lookup is
	// the difference between one pass and several million string allocations
	// on a plan with six figures of operations.
	refs := make([]OpRef, len(p.Ops))
	known := make(map[OpRef]bool, len(p.Ops))
	groups := make(map[GroupID][]OpRef)
	for i, o := range p.Ops {
		refs[i] = o.Ref()
		known[refs[i]] = true
		if o.Group != "" {
			groups[o.Group] = append(groups[o.Group], refs[i])
		}
	}

	dropped := make(map[OpRef]Reason, len(vetoes))
	for _, v := range vetoes {
		if !known[v.Ref] {
			return nil, ErrUnknownOp
		}
		reason := v.Reason
		if reason == "" {
			reason = ReasonVetoed
		}
		dropped[v.Ref] = reason
	}

	// Fixpoint. DependsOn already encodes both directions of the rule — an
	// operation placing something in a container depends on the ensure, and a
	// container removal depends on the operations that empty it — so a single
	// "drop anything that depended on something dropped" pass implements both
	// the downward and the upward cascade.
	for changed := true; changed; {
		changed = false
		// Operations are in dependency order, so one forward pass usually
		// reaches the fixpoint; the loop is what guarantees it.
		for i, o := range p.Ops {
			if _, gone := dropped[refs[i]]; gone {
				continue
			}
			for _, dep := range o.DependsOn {
				if _, gone := dropped[dep]; gone {
					dropped[refs[i]] = ReasonVetoedDependency
					changed = true
					break
				}
			}
		}
		for _, members := range groups {
			hit := false
			for _, ref := range members {
				if _, gone := dropped[ref]; gone {
					hit = true
					break
				}
			}
			if !hit {
				continue
			}
			for _, ref := range members {
				if _, gone := dropped[ref]; !gone {
					dropped[ref] = ReasonVetoedDependency
					changed = true
				}
			}
		}
	}

	kept := make([]Op, 0, len(p.Ops)-len(dropped))
	for i, o := range p.Ops {
		if _, gone := dropped[refs[i]]; gone {
			continue
		}
		o.DependsOn = nil // order rebuilds it from the surviving set
		kept = append(kept, o)
	}

	// Removed states that this plan deletes something the target holds. Once a
	// veto drops the deletion that is no longer true, and a preview that still
	// claims it describes a destructive change that will not happen.
	stillRemoved := make(map[Key]bool, len(kept))
	for _, o := range kept {
		if o.Kind == OpDelete || o.Kind == OpRemoveContainer {
			stillRemoved[o.Key] = true
		}
	}
	out := &Plan{
		Exclusions: reflagRemoved(p.Exclusions, stillRemoved),
		Rejected:   reflagRemoved(p.Rejected, stillRemoved),
		Mode:       p.Mode,
		Scope:      p.Scope,
	}
	for i, o := range p.Ops {
		reason, gone := dropped[refs[i]]
		if !gone {
			continue
		}
		out.Exclusions = append(out.Exclusions, Exclusion{Key: o.Key, Reason: reason})
	}
	sortExclusions(out.Exclusions)
	// Capacity edges live in DependsOn, so vetoing a deletion already drops the
	// creates that were waiting on it via the fixpoint above; order() rebuilds
	// the rest from the surviving set.
	if err := order(out, kept, len(p.Rejected) > 0 || budgetOrdered(p)); err != nil {
		return nil, err
	}
	return out, nil
}

// reflagRemoved restates each exclusion's Removed against the operations that
// survived, leaving everything else about it alone.
func reflagRemoved(in []Exclusion, stillRemoved map[Key]bool) []Exclusion {
	if len(in) == 0 {
		return nil
	}
	out := make([]Exclusion, len(in))
	copy(out, in)
	for i := range out {
		if out[i].Removed {
			out[i].Removed = stillRemoved[out[i].Key]
		}
	}
	return out
}

// budgetOrdered reports whether the plan it came from had creation waiting on
// deletion, so Restrict does not silently drop that floor.
func budgetOrdered(p *Plan) bool {
	lastDelete, firstCreate := -1, -1
	for i, stage := range p.Stages {
		for _, o := range stage {
			switch o.Kind {
			case OpDelete:
				lastDelete = i
			case OpCreate:
				if firstCreate < 0 {
					firstCreate = i
				}
			default:
			}
		}
	}
	return lastDelete >= 0 && firstCreate > lastDelete
}

func clonePlan(p *Plan) *Plan {
	out := &Plan{
		Ops:        append([]Op(nil), p.Ops...),
		Exclusions: append([]Exclusion(nil), p.Exclusions...),
		Rejected:   append([]Exclusion(nil), p.Rejected...),
		Mode:       p.Mode,
		Scope:      p.Scope,
	}
	out.Stages = make([][]Op, len(p.Stages))
	for i, s := range p.Stages {
		out.Stages[i] = append([]Op(nil), s...)
	}
	return out
}
