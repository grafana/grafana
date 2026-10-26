package converge

import (
	"errors"
	"testing"
)

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

func TestWantedIdentityIsTheSurvivorAmongDuplicates(t *testing.T) {
	// The key holds both the wanted identity and another. Letting identity
	// order pick the survivor re-identifies the container *to* the identity it
	// already has, and removes that same identity as surplus — an empty folder
	// loses both.
	p, err := NewPlan(
		[]Declaration{{Key: "f/", Container: true, Identity: "Z"}},
		[]Observation{
			{Key: "f/", Identity: "A", Container: true},
			{Key: "f/", Identity: "Z", Container: true},
		},
		WithContainers(ContainerConfig{Implied: true}),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, o := range p.Ops {
		if o.Kind == OpRemoveContainer && o.Identity == "Z" {
			t.Fatalf("the wanted identity must survive:\n%s", p)
		}
	}
	op, _ := findOp(t, p, OpRemoveContainer, "f/")
	if op.Identity != "A" {
		t.Fatalf("want A removed, got %q:\n%s", op.Identity, p)
	}
	mustNotHave(t, p, OpEnsureContainer, "f/")
}

func TestConflictingContainerClaimsAreRejected(t *testing.T) {
	// Letting the later declaration win makes the plan depend on declaration
	// order, which is the one thing the planner promises it does not.
	forward := []Declaration{
		{Key: "f/", Container: true, Identity: "ONE"},
		{Key: "f/", Container: true, Identity: "TWO"},
	}
	reversed := []Declaration{forward[1], forward[0]}

	for _, decls := range [][]Declaration{forward, reversed} {
		_, err := NewPlan(decls, nil, WithContainers(hierarchy()))
		if !errors.Is(err, ErrConflictingDeclaration) {
			t.Fatalf("want ErrConflictingDeclaration, got %v", err)
		}
	}
}

func TestTargetedDeleteOfANonEmptyContainerIsNotPlanned(t *testing.T) {
	// Keeping the removal while the operations that would empty it are dropped
	// produces a plan that violates the empty-before-removal guarantee — and a
	// caller that asked to delete one folder did not ask to delete its contents.
	p, err := NewPlan(
		nil,
		[]Observation{
			{Key: "f/", Identity: "F", Container: true},
			held("f/one.json", "D1", "h1"),
		},
		WithContainers(ContainerConfig{Implied: true}),
		WithHints(HintSet{Keys: []Key{"f/"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}
	mustNotHave(t, p, OpRemoveContainer, "f/")
	if !p.Empty() {
		t.Fatalf("a non-recursive delete of a non-empty folder plans nothing:\n%s", p)
	}
}

func TestClosureFollowsAncestorsOfFingerprintMatches(t *testing.T) {
	// A key admitted because its content matches a hinted key still needs its
	// ancestors, or the plan treats the existing folder as missing and
	// re-parents what is inside it.
	decls := []Declaration{
		entity("a/new.json", "h1"),
		{Key: "b/", Container: true, Identity: "PINNED"},
		entity("b/kept.json", "h1"),
	}
	obs := []Observation{
		{Key: "b/", Identity: "PINNED", Container: true},
		held("b/kept.json", "D1", "h1"),
	}

	in := HintSet{Keys: []Key{"a/new.json"}, Complete: true}.closure(decls, obs, hierarchy())
	if !in["b/kept.json"] {
		t.Fatal("the fingerprint match must be in the window")
	}
	if !in["b/"] {
		t.Fatalf("its container must come with it: %v", in)
	}
}

func TestClosureFollowsIdentityClaims(t *testing.T) {
	// A declaration claiming an identity another container holds can only be
	// demoted if both are in the window; otherwise a hinted plan accepts a
	// claim a full plan refuses.
	decls := []Declaration{
		{Key: "a/", Container: true, Identity: "X"},
		{Key: "b/", Container: true, Identity: "X"},
	}
	in := HintSet{Keys: []Key{"b/"}, Complete: true}.closure(decls, nil, hierarchy())
	if !in["a/"] {
		t.Fatalf("the other claimant of X must be in the window: %v", in)
	}
}

func TestConvergentPlanReportsExcludedContainersOutsideTheWindow(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			entity("a.json", "h1"),
			{Key: "bad/", Container: true, Verdict: Excluded, Reason: "unaddressable"},
		},
		nil,
		WithContainers(hierarchy()),
		WithHints(HintSet{Keys: []Key{"a.json"}, Complete: true}),
	)
	if err != nil {
		t.Fatal(err)
	}
	var found int
	for _, e := range p.Exclusions {
		if e.Key == "bad/" {
			found++
		}
	}
	if found != 1 {
		t.Fatalf("want the container reported exactly once, got %d: %v", found, p.Exclusions)
	}
}

func TestCapacityPrerequisiteIsADependencyNotAStageNumber(t *testing.T) {
	// A floor on the stage number moves nothing else, so Restrict would leave
	// the create executable after the deletion that frees its slot is vetoed.
	p, err := NewPlan(
		[]Declaration{entity("a.json", "h1")},
		[]Observation{held("z.json", "Z", "h9")},
		WithBudget(Budget{MaxEntities: 1}),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}
	create, _ := findOp(t, p, OpCreate, "a.json")
	del, _ := findOp(t, p, OpDelete, "z.json")
	if len(create.DependsOn) == 0 {
		t.Fatalf("the create must depend on capacity being freed:\n%s", p)
	}

	restricted, err := Restrict(p, []Veto{{Ref: del.Ref(), Reason: "forbidden"}})
	if err != nil {
		t.Fatal(err)
	}
	if !restricted.Empty() {
		t.Fatalf("vetoing the deletion must drop the create that waited on it:\n%s", restricted)
	}
}

func TestTargetedContentEditSurvivesAnApparentParentChange(t *testing.T) {
	// A nested folder whose observed parent is a pinned UID gets
	// ReasonParentChanged, because a targeted plan declares a bare ancestor
	// whose derived identity differs. Matching on ReasonContentChanged alone
	// dropped the edit the caller actually asked for.
	p, err := NewPlan(
		[]Declaration{
			{Key: "top/f/", Container: true, Identity: "PINNED", Fingerprint: "m2"},
			{Key: "top/", Container: true},
		},
		[]Observation{
			{Key: "top/", Identity: "TOP-PINNED", Container: true},
			{Key: "top/f/", Identity: "PINNED", Fingerprint: "m1", Container: true, Parent: "TOP-PINNED"},
		},
		WithContainers(hierarchy()),
		WithHints(HintSet{Keys: []Key{"top/f/"}, Complete: true}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}

	op, _ := findOp(t, p, OpEnsureContainer, "top/f/")
	if op.Identity != "PINNED" {
		t.Fatalf("the held identity must be kept, got %q", op.Identity)
	}
	// The identity must be marked observed, or a veto pass treats a
	// path-derived fallback as trusted and checks permission against a folder
	// that does not exist.
	if !op.IdentityProvenance.Trusted() {
		t.Fatalf("the held identity must be trusted, got %s", op.IdentityProvenance)
	}
	// ContainerIdentity describes the container this one sits in, not this one.
	if op.ContainerIdentity != "TOP-PINNED" || !op.ContainerProvenance.Trusted() {
		t.Fatalf("parent identity must be the held one and trusted: %q %s",
			op.ContainerIdentity, op.ContainerProvenance)
	}
}

func TestHintClosureNormalisesContainerKeys(t *testing.T) {
	// newState normalises container keys, so computing the closure over the raw
	// inputs makes "b" and "b/" behave differently: the identity link is missed
	// and the normalised observation is then filtered out.
	decls := []Declaration{{Key: "b", Container: true, Identity: "X"}}
	obs := []Observation{{Key: "a/", Identity: "X", Container: true}}

	p, err := NewPlan(decls, obs,
		WithContainers(hierarchy()),
		WithHints(HintSet{Keys: []Key{"b/"}, Complete: true}),
	)
	if err != nil {
		t.Fatal(err)
	}
	op, _ := findOp(t, p, OpMove, "b/")
	if op.From != "a/" {
		t.Fatalf("want a move from a/, got %+v:\n%s", op, p)
	}
}

func TestHeldExcludedContainerIsReportedAsDestructive(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{{Key: "bad/", Container: true, Verdict: Excluded, Reason: "unaddressable"}},
		[]Observation{{Key: "bad/", Identity: "F", Container: true}},
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range p.Exclusions {
		if e.Key == "bad/" {
			if !e.Removed {
				t.Fatal("a held folder the plan removes is a destructive exclusion")
			}
			return
		}
	}
	t.Fatalf("the container was not reported: %v", p.Exclusions)
}

// An exclusion's Removed says this plan deletes something the target holds.
// Vetoing the deletion makes that false, and a preview that still claims it
// describes a destructive change that will not happen.
func TestRestrictRestatesRemovedAgainstSurvivingDeletions(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			{Key: "bad.json", Fingerprint: "h1", Verdict: Excluded, Reason: "unsupported"},
		},
		[]Observation{
			{Key: "bad.json", Identity: "id-bad", Fingerprint: "h1"},
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	if len(p.Exclusions) != 1 || !p.Exclusions[0].Removed {
		t.Fatalf("expected one destructive exclusion, got %+v", p.Exclusions)
	}
	if len(p.Ops) != 1 || p.Ops[0].Kind != OpDelete {
		t.Fatalf("expected one deletion, got %+v", p.Ops)
	}

	restricted, err := Restrict(p, []Veto{{Ref: p.Ops[0].Ref(), Reason: "forbidden"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(restricted.Ops) != 0 {
		t.Fatalf("the deletion should be gone, got %+v", restricted.Ops)
	}
	for _, e := range restricted.Exclusions {
		if e.Key == "bad.json" && e.Removed {
			t.Fatal("the exclusion still claims the entity is removed after the deletion was vetoed")
		}
	}
}

// The hint closure admits keys reached by a fingerprint match so a relocation
// can be paired. That context must not become folders: a targeted write of one
// file created an unrelated folder whose only link to the request was a
// matching content hash.
func TestTargetedPlanDoesNotCreateFoldersOnlyTheClosureReached(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			{Key: "a/", Container: true},
			{Key: "a/new.json", Fingerprint: "same"},
			{Key: "b/", Container: true},
			{Key: "b/other.json", Fingerprint: "same"},
		},
		nil,
		WithContainers(ContainerConfig{
			Implied:          true,
			FallbackIdentity: func(k Key) Identity { return Identity("auto:" + string(k)) },
		}),
		WithHints(HintSet{Complete: true, Keys: []Key{"a/new.json"}}),
		WithExclusionScope(ScopeTargeted),
	)
	if err != nil {
		t.Fatal(err)
	}

	for _, op := range p.Ops {
		if op.Key == "b/" || op.Key.Within("b/") {
			t.Fatalf("targeted write of a/new.json planned %s %s:\n%s", op.Kind, op.Key, p)
		}
	}
	if len(p.Ops) != 2 {
		t.Fatalf("expected the folder and the write, got:\n%s", p)
	}
}
