package converge

import "testing"

// A targeted plan is the shape an interactive write takes. It must do what it
// was asked and nothing else: the container it lands in gets created if
// missing, and everything else in the hint closure is context, not a mandate.
func TestTargetedPlanTouchesOnlyWhatItWasAsked(t *testing.T) {
	desired := []Declaration{entity("team/new.json", "h9")}
	inventory := []Observation{
		heldContainer("team/", "F-TEAM"),
		held("team/unrelated.json", "D1", "h1"),
		heldContainer("elsewhere/", "F-OTHER"),
	}

	p, err := NewPlan(desired, inventory,
		WithContainers(hierarchy()),
		WithHints(HintSet{Keys: []Key{"team/new.json"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(p.Ops) != 1 {
		t.Fatalf("want exactly the create, got:\n%s", p)
	}
	op := p.Ops[0]
	if op.Kind != OpCreate || op.Key != "team/new.json" {
		t.Fatalf("unexpected op %+v", op)
	}
	if op.ContainerIdentity != "F-TEAM" || !op.ContainerProvenance.Trusted() {
		// A veto pass authorises against this, so it must be what the target
		// holds rather than anything the request implied.
		t.Fatalf("container resolution not trusted: %q %s", op.ContainerIdentity, op.ContainerProvenance)
	}
}

func TestTargetedPlanCreatesTheContainersItNeeds(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{entity("new/deep/file.json", "h1")},
		nil,
		WithContainers(hierarchy()),
		WithHints(HintSet{Keys: []Key{"new/deep/file.json"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}
	_, outer := findOp(t, p, OpEnsureContainer, "new/")
	_, inner := findOp(t, p, OpEnsureContainer, "new/deep/")
	_, create := findOp(t, p, OpCreate, "new/deep/file.json")
	if outer >= inner || inner >= create {
		t.Fatalf("stages out of order: %d %d %d\n%s", outer, inner, create, p)
	}
}

func TestConvergentPlanStillReidentifiesAndRemoves(t *testing.T) {
	// The same inputs as the targeted case, planned as a convergence run,
	// must act on everything — that is the difference between the two claims.
	p, err := NewPlan(
		[]Declaration{entity("team/new.json", "h9")},
		[]Observation{
			heldContainer("team/", "F-TEAM"),
			held("team/unrelated.json", "D1", "h1"),
			heldContainer("elsewhere/", "F-OTHER"),
		},
		WithContainers(hierarchy()),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}
	findOp(t, p, OpDelete, "team/unrelated.json")
	findOp(t, p, OpRemoveContainer, "elsewhere/")
	findOp(t, p, OpEnsureContainer, "team/") // re-identified to the derived identity
}

func TestEmptyCompleteHintSetIsRefused(t *testing.T) {
	// An empty complete hint set would produce an empty plan indistinguishable
	// from convergence.
	_, err := NewPlan([]Declaration{entity("a.json", "h")}, nil,
		WithHints(HintSet{Complete: true}))
	if err == nil {
		t.Fatal("want an error for an empty complete hint set")
	}
}
