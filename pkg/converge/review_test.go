package converge

import "testing"

// Each test here is named after a failure a reviewer found, not after the fix.

func TestRefDoesNotCollideOnSeparatorsInKeys(t *testing.T) {
	// Keys are opaque and may contain any character, so joining fields with a
	// separator makes distinct operations share a reference — and every map
	// keyed by it would conflate them.
	a := Op{Kind: OpMove, From: "a|b", Key: "c", Identity: "X"}
	b := Op{Kind: OpMove, From: "a", Key: "b|c", Identity: "X"}
	if a.Ref() == b.Ref() {
		t.Fatalf("distinct moves share a reference: %q", a.Ref())
	}
}

func TestHintClosureDoesNotDependOnInputOrder(t *testing.T) {
	// The closure is transitive: whether a key is in the window depends on
	// whether its parent is, so one pass over the inputs leaves membership at
	// the mercy of slice order.
	deep := []Declaration{
		entity("a/b/c/d/e.json", "h1"),
		{Key: "a/b/c/", Container: true},
		{Key: "a/b/", Container: true},
		{Key: "a/", Container: true},
	}
	reversed := []Declaration{deep[3], deep[2], deep[1], deep[0]}

	hints := HintSet{Keys: []Key{"a/"}, Complete: true}
	leafFirst := hints.closure(deep, nil, hierarchy())
	rootFirst := hints.closure(reversed, nil, hierarchy())

	for _, k := range []Key{"a/", "a/b/", "a/b/c/", "a/b/c/d/e.json"} {
		if leafFirst[k] != rootFirst[k] {
			t.Fatalf("closure of %q depends on input order: leaf-first=%t root-first=%t",
				k, leafFirst[k], rootFirst[k])
		}
	}
}

func TestEntityInsideRefusedContainerIsNotPlanned(t *testing.T) {
	// A container declared inside one the source refuses cannot exist either,
	// so nothing may be ensured or written inside it.
	p, err := NewPlan(
		[]Declaration{
			{Key: "bad/", Container: true, Verdict: Excluded, Reason: "unholdable"},
			{Key: "bad/child/", Container: true},
			entity("bad/child/one.json", "h1"),
		},
		nil,
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	if !p.Empty() {
		t.Fatalf("nothing inside a refused container may be planned:\n%s", p)
	}
	for _, want := range []Key{"bad/", "bad/child/", "bad/child/one.json"} {
		found := false
		for _, e := range p.Exclusions {
			if e.Key == want {
				found = true
			}
		}
		if !found {
			t.Fatalf("%q was dropped without being reported: %v", want, p.Exclusions)
		}
	}
}

func TestConvergentPlanReportsExclusionsOutsideTheWindow(t *testing.T) {
	// Narrowing the work must not narrow the warnings. A convergent plan
	// claims to have surveyed the source, so an excluded key it did not touch
	// goes on being named.
	desired := []Declaration{
		entity("a.json", "h1"),
		excluded("bad .json", "unaddressable"),
	}
	p, err := NewPlan(desired, nil,
		WithHints(HintSet{Keys: []Key{"a.json"}, Complete: true}))
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Exclusions) != 1 || p.Exclusions[0].Key != "bad .json" {
		t.Fatalf("an exclusion outside the window went unreported: %v", p.Exclusions)
	}
}

func TestBudgetForcesAFullPlan(t *testing.T) {
	// Admission is a question about the whole target, which a window cannot
	// answer: a hinted run would admit a create without counting what it was
	// not pointed at.
	p, err := NewPlan(
		[]Declaration{entity("a.json", "h1"), entity("b.json", "h2")},
		[]Observation{held("a.json", "A", "h1")},
		WithBudget(Budget{MaxEntities: 1}),
		WithHints(HintSet{Keys: []Key{"b.json"}, Complete: true}),
	)
	if err != nil {
		t.Fatal(err)
	}
	if p.Mode != ModeFull {
		t.Fatalf("a budget must force a full plan, got %s", p.Mode)
	}
	if len(p.Rejected) != 1 || p.Rejected[0].Key != "b.json" {
		t.Fatalf("want b.json rejected, got %v", p.Rejected)
	}
}

func TestCapacityBoundReplacementDeletesFirst(t *testing.T) {
	// Nothing is rejected here — the admitted set fits — but the target will
	// refuse the create until the delete frees its slot.
	p, err := NewPlan(
		[]Declaration{entity("a.json", "h1")},
		[]Observation{held("z.json", "Z", "h9")},
		WithBudget(Budget{MaxEntities: 1}),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}
	_, del := findOp(t, p, OpDelete, "z.json")
	_, create := findOp(t, p, OpCreate, "a.json")
	if del >= create {
		t.Fatalf("the delete must free capacity first: delete=%d create=%d\n%s", del, create, p)
	}
}

func TestTargetedWriteDoesNotConsumeAnUnnamedResource(t *testing.T) {
	// Pairing a targeted create with a row nobody mentioned turns "create a
	// copy here" into "move that other resource".
	p, err := NewPlan(
		[]Declaration{entity("team/new.json", "h1")},
		[]Observation{
			heldContainer("team/", "F"),
			held("team/unrelated.json", "D1", "h1"),
		},
		WithContainers(ContainerConfig{Implied: true}),
		WithHints(HintSet{Keys: []Key{"team/new.json"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, o := range p.Ops {
		if o.Kind == OpMove {
			t.Fatalf("a targeted write consumed %q:\n%s", o.From, p)
		}
		if o.Kind == OpDelete {
			t.Fatalf("a targeted write deleted %q:\n%s", o.Key, p)
		}
	}
	findOp(t, p, OpCreate, "team/new.json")
}

func TestTargetedContentUpdateOnANamedContainerSurvives(t *testing.T) {
	// The caller named this container and its content changed, so that is the
	// write it asked for — but its identity still comes from the target.
	p, err := NewPlan(
		[]Declaration{{Key: "f/", Container: true, Identity: "KEEP", Fingerprint: "m2"}},
		[]Observation{{Key: "f/", Identity: "KEEP", Fingerprint: "m1", Container: true}},
		WithContainers(ContainerConfig{Implied: true}),
		WithHints(HintSet{Keys: []Key{"f/"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}
	op, _ := findOp(t, p, OpEnsureContainer, "f/")
	if op.Identity != "KEEP" || !op.ContainerProvenance.Trusted() {
		t.Fatalf("a targeted update must keep the observed identity: %+v", op)
	}
}
