package converge

import (
	"errors"
	"testing"
)

func entity(key, fp string) Declaration {
	return Declaration{Key: Key(key), Fingerprint: Fingerprint(fp)}
}

func excluded(key, reason string) Declaration {
	return Declaration{Key: Key(key), Verdict: Excluded, Reason: Reason(reason)}
}

func ignored(key string) Declaration {
	return Declaration{Key: Key(key), Verdict: Ignored}
}

func held(key, id, fp string) Observation {
	return Observation{Key: Key(key), Identity: Identity(id), Fingerprint: Fingerprint(fp)}
}

func heldContainer(key, id string) Observation {
	return Observation{Key: Key(key).AsContainer(), Identity: Identity(id), Container: true}
}

// autoContainer is a container the target holds under the identity the key
// derives, which is the steady state when nothing pins one.
func autoContainer(key string) Observation {
	k := Key(key).AsContainer()
	return Observation{Key: k, Identity: autoID(k), Container: true}
}

func autoID(k Key) Identity { return Identity("auto-" + string(k)) }

// hierarchy is the configuration a target with real containers uses: implied
// from entity keys, identity derived from the key unless the source pins one.
func hierarchy() ContainerConfig {
	return ContainerConfig{
		Implied:          true,
		FallbackIdentity: autoID,
	}
}

func findOp(t *testing.T, p *Plan, kind OpKind, key Key) (Op, int) {
	t.Helper()
	for si, stage := range p.Stages {
		for _, o := range stage {
			if o.Kind == kind && o.Key == key {
				return o, si
			}
		}
	}
	t.Fatalf("no %s for %q in plan:\n%s", kind, key, p)
	return Op{}, -1
}

func mustNotHave(t *testing.T, p *Plan, kind OpKind, key Key) {
	t.Helper()
	for _, o := range p.Ops {
		if o.Kind == kind && o.Key == key {
			t.Fatalf("unexpected %s for %q in plan:\n%s", kind, key, p)
		}
	}
}

func TestExcludedEntityIsAbsentAndNamed(t *testing.T) {
	// The worked example from the contract: a file renamed onto a key the
	// target cannot address is not a declaration, so what it used to declare
	// is removed and the new key is reported.
	p, err := NewPlan(
		[]Declaration{
			entity("a/one.json", "h1"),
			excluded("a/Bad & Name.json", "unaddressable-key"),
		},
		[]Observation{
			held("a/one.json", "E1", "h1"),
			held("a/two.json", "E2", "h2"),
			autoContainer("a/"),
		},
		WithContainers(hierarchy()),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}

	// Nothing declares a/two.json any more, so it goes.
	findOp(t, p, OpDelete, "a/two.json")
	mustNotHave(t, p, OpUpdate, "a/one.json")
	mustNotHave(t, p, OpCreate, "a/Bad & Name.json")

	if len(p.Exclusions) != 1 {
		t.Fatalf("want 1 exclusion, got %d: %v", len(p.Exclusions), p.Exclusions)
	}
	if got := p.Exclusions[0]; got.Key != "a/Bad & Name.json" || got.Reason != "unaddressable-key" || got.Removed {
		t.Fatalf("unexpected exclusion %+v", got)
	}
}

func TestIgnoredDeclarationsAreInvisible(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{ignored("a/README.md"), ignored("a/logo.png")},
		nil,
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	if !p.Empty() {
		t.Fatalf("want empty plan, got:\n%s", p)
	}
	if len(p.Exclusions) != 0 {
		t.Fatalf("ignored keys must never be reported, got %v", p.Exclusions)
	}
}

func TestContainerExistsBeforeItsContents(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{entity("a/b/c.json", "h1")},
		nil,
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}

	_, outer := findOp(t, p, OpEnsureContainer, "a/")
	_, inner := findOp(t, p, OpEnsureContainer, "a/b/")
	_, create := findOp(t, p, OpCreate, "a/b/c.json")

	if outer >= inner || inner >= create {
		t.Fatalf("stages out of order: a/=%d a/b/=%d create=%d\n%s", outer, inner, create, p)
	}
}

func TestContainerRemovedOnlyAfterItIsEmptied(t *testing.T) {
	p, err := NewPlan(
		nil,
		[]Observation{
			held("a/b/c.json", "E1", "h1"),
			autoContainer("a/"),
			autoContainer("a/b/"),
		},
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}

	_, del := findOp(t, p, OpDelete, "a/b/c.json")
	_, rmInner := findOp(t, p, OpRemoveContainer, "a/b/")
	_, rmOuter := findOp(t, p, OpRemoveContainer, "a/")

	if del >= rmInner || rmInner >= rmOuter {
		t.Fatalf("stages out of order: delete=%d a/b/=%d a/=%d\n%s", del, rmInner, rmOuter, p)
	}
}

func TestMoveDetectionPairsByContent(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{entity("a/new.json", "h1")},
		[]Observation{held("a/old.json", "E1", "h1"), autoContainer("a/")},
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}

	op, _ := findOp(t, p, OpMove, "a/new.json")
	if op.From != "a/old.json" || op.Identity != "E1" {
		t.Fatalf("unexpected move %+v", op)
	}
	mustNotHave(t, p, OpDelete, "a/old.json")
	mustNotHave(t, p, OpCreate, "a/new.json")
}

func TestAmbiguousContentDegradesToDeleteAndCreate(t *testing.T) {
	// Two deletions share a fingerprint, so the right partner is unknowable.
	// The target still ends up holding the same content; only the surviving
	// identity differs. That is a degradation, not an error.
	p, err := NewPlan(
		[]Declaration{entity("a/new.json", "h1")},
		[]Observation{
			held("a/old1.json", "E1", "h1"),
			held("a/old2.json", "E2", "h1"),
			autoContainer("a/"),
		},
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	for _, o := range p.Ops {
		if o.Kind == OpMove {
			t.Fatalf("must not pair an ambiguous fingerprint:\n%s", p)
		}
	}
	findOp(t, p, OpCreate, "a/new.json")
	findOp(t, p, OpDelete, "a/old1.json")
	findOp(t, p, OpDelete, "a/old2.json")
}

func TestContainerReidentificationReparentsThenRemoves(t *testing.T) {
	// The source pins a new identity for a/. Children must be rewritten to
	// follow it, and the container they left must survive until they have.
	p, err := NewPlan(
		[]Declaration{
			{Key: "a/", Container: true, Identity: "NEW", Fingerprint: "m2"},
			entity("a/c.json", "h1"),
		},
		[]Observation{
			heldContainer("a/", "OLD"),
			held("a/c.json", "E1", "h1"),
		},
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}

	ensure, ensureStage := findOp(t, p, OpEnsureContainer, "a/")
	update, updateStage := findOp(t, p, OpUpdate, "a/c.json")
	remove, removeStage := findOp(t, p, OpRemoveContainer, "a/")

	if ensureStage >= updateStage || updateStage >= removeStage {
		t.Fatalf("stages out of order: ensure=%d update=%d remove=%d\n%s",
			ensureStage, updateStage, removeStage, p)
	}
	if ensure.Identity != "NEW" || remove.Identity != "OLD" {
		t.Fatalf("identities wrong: ensure=%q remove=%q", ensure.Identity, remove.Identity)
	}
	if update.Reason != ReasonReparent {
		t.Fatalf("child rewrite must say why, got %q", update.Reason)
	}
	if ensure.Group == "" || ensure.Group != update.Group || update.Group != remove.Group {
		t.Fatalf("re-identification must be one group: %q %q %q",
			ensure.Group, update.Group, remove.Group)
	}
	// The pinned identity is the container's own, so its provenance is the one
	// that records the source asserted it. ContainerProvenance describes the
	// container this one sits in, which here is the root.
	if ensure.IdentityProvenance != FromDeclaration {
		t.Fatalf("a pinned identity comes from the source, got %s", ensure.IdentityProvenance)
	}
	if ensure.Container != "" || ensure.ContainerIdentity != "" {
		t.Fatalf("a root container has no parent: %q %q", ensure.Container, ensure.ContainerIdentity)
	}
}

func TestDuplicatesAtOneKeyPickAStableSurvivor(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{entity("a/c.json", "h1")},
		[]Observation{
			held("a/c.json", "E2", "stale"),
			held("a/c.json", "E1", "h1"),
			autoContainer("a/"),
		},
		WithContainers(hierarchy()),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}

	var deleted []Identity
	for _, o := range p.Ops {
		if o.Kind == OpDelete && o.Key == "a/c.json" {
			if o.Reason != ReasonDuplicate {
				t.Fatalf("duplicate cleanup must say why, got %q", o.Reason)
			}
			deleted = append(deleted, o.Identity)
		}
	}
	if len(deleted) != 1 || deleted[0] != "E2" {
		// E1's content matches the declaration, so E1 is the survivor.
		t.Fatalf("want E2 deleted, got %v\n%s", deleted, p)
	}
	mustNotHave(t, p, OpUpdate, "a/c.json")
}

func TestBudgetAdmitsByKeyOrderNotArrivalOrder(t *testing.T) {
	decls := []Declaration{
		entity("z.json", "h"), entity("m.json", "h2"), entity("a.json", "h3"),
	}
	reversed := []Declaration{decls[2], decls[1], decls[0]}

	for _, in := range [][]Declaration{decls, reversed} {
		p, err := NewPlan(in, nil, WithBudget(Budget{MaxEntities: 2}), WithMoveDetection(false))
		if err != nil {
			t.Fatal(err)
		}
		if len(p.Rejected) != 1 || p.Rejected[0].Key != "z.json" {
			t.Fatalf("want z.json rejected, got %v", p.Rejected)
		}
		if p.Rejected[0].Reason != ReasonOverBudget {
			t.Fatalf("unexpected reason %q", p.Rejected[0].Reason)
		}
	}
}

func TestInputOrderDoesNotChangeThePlan(t *testing.T) {
	decls := []Declaration{
		entity("a/b/x.json", "h1"), entity("a/y.json", "h2"), excluded("a/bad .json", "r"),
		{Key: "a/", Container: true, Identity: "C1"},
	}
	obs := []Observation{
		held("a/gone.json", "E9", "h9"), heldContainer("a/", "C1"), held("a/y.json", "E2", "old"),
	}

	base, err := NewPlan(decls, obs, WithContainers(hierarchy()))
	if err != nil {
		t.Fatal(err)
	}
	shuffledDecls := []Declaration{decls[3], decls[1], decls[2], decls[0]}
	shuffledObs := []Observation{obs[2], obs[0], obs[1]}
	other, err := NewPlan(shuffledDecls, shuffledObs, WithContainers(hierarchy()))
	if err != nil {
		t.Fatal(err)
	}
	if base.String() != other.String() {
		t.Fatalf("plan depends on input order:\n%s\n--- vs ---\n%s", base, other)
	}
}

func TestDuplicateDeclarationIsRejected(t *testing.T) {
	_, err := NewPlan([]Declaration{entity("a.json", "h"), entity("a.json", "h2")}, nil)
	if !errors.Is(err, ErrInvalidDeclaration) {
		t.Fatalf("want ErrInvalidDeclaration, got %v", err)
	}
}

func TestExcludedDeclarationNeedsAReason(t *testing.T) {
	_, err := NewPlan([]Declaration{{Key: "a.json", Verdict: Excluded}}, nil)
	if !errors.Is(err, ErrInvalidDeclaration) {
		t.Fatalf("want ErrInvalidDeclaration, got %v", err)
	}
}

func TestDepthLimitFailsRatherThanTruncating(t *testing.T) {
	cc := hierarchy()
	cc.MaxDepth = 2
	_, err := NewPlan([]Declaration{entity("a/b/c/d.json", "h")}, nil, WithContainers(cc))
	if !errors.Is(err, ErrDepthExceeded) {
		t.Fatalf("want ErrDepthExceeded, got %v", err)
	}
}

func TestEntityUnderAnExcludedContainerIsExcludedToo(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			{Key: "bad/", Container: true, Verdict: Excluded, Reason: "container-unaddressable"},
			entity("bad/c.json", "h1"),
		},
		[]Observation{held("bad/c.json", "E1", "h1"), autoContainer("bad/")},
		WithContainers(hierarchy()),
		WithMoveDetection(false),
	)
	if err != nil {
		t.Fatal(err)
	}
	findOp(t, p, OpDelete, "bad/c.json")
	var sawChild bool
	for _, e := range p.Exclusions {
		if e.Key == "bad/c.json" {
			sawChild = true
			if e.Reason != ReasonContainerExcluded || !e.Removed {
				t.Fatalf("unexpected exclusion %+v", e)
			}
		}
	}
	if !sawChild {
		t.Fatalf("the child must be named too, got %v", p.Exclusions)
	}
}

func TestProvenancePrefersWhatTheTargetHolds(t *testing.T) {
	// The source asserts an identity for a/ that the target does not have at
	// the key. Anything landing inside must report where the identity came
	// from, so a veto pass does not authorise against an asserted value.
	p, err := NewPlan(
		[]Declaration{entity("a/c.json", "h1")},
		[]Observation{heldContainer("a/", "TRUSTED")},
		WithContainers(ContainerConfig{Implied: true}),
	)
	if err != nil {
		t.Fatal(err)
	}
	op, _ := findOp(t, p, OpCreate, "a/c.json")
	if op.Container != "a/" || op.ContainerIdentity != "TRUSTED" {
		t.Fatalf("unexpected container resolution %+v", op)
	}
	if !op.ContainerProvenance.Trusted() {
		t.Fatalf("want an observed identity, got %s", op.ContainerProvenance)
	}
}

// A container is implied by the keys beneath it and may also be described
// explicitly. Those declarations merge rather than collide: making every
// caller collapse them first is asking each one to re-implement the rule.
func TestContainerDeclarationsMerge(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			{Key: "a/", Container: true},                                        // implied by the tree
			{Key: "a/", Container: true, Identity: "PINNED", Fingerprint: "m1"}, // described by metadata
			entity("a/one.json", "h1"),
		},
		nil,
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	op, _ := findOp(t, p, OpEnsureContainer, "a/")
	if op.Identity != "PINNED" {
		t.Fatalf("the stated identity must win over bare existence, got %q", op.Identity)
	}
	if op.Fingerprint != "m1" {
		t.Fatalf("the stated content must survive the merge, got %q", op.Fingerprint)
	}
}

func TestContainerRefusalWinsTheMerge(t *testing.T) {
	p, err := NewPlan(
		[]Declaration{
			{Key: "bad/", Container: true, Identity: "X"},
			{Key: "bad/", Container: true, Verdict: Excluded, Reason: "unholdable"},
		},
		nil,
		WithContainers(hierarchy()),
	)
	if err != nil {
		t.Fatal(err)
	}
	mustNotHave(t, p, OpEnsureContainer, "bad/")
	if len(p.Exclusions) != 1 || p.Exclusions[0].Reason != "unholdable" {
		t.Fatalf("the refusal must survive, got %v", p.Exclusions)
	}
}

func TestDuplicateEntityDeclarationStillFails(t *testing.T) {
	_, err := NewPlan([]Declaration{entity("a.json", "h1"), entity("a.json", "h2")}, nil)
	if !errors.Is(err, ErrInvalidDeclaration) {
		t.Fatalf("one address, one entity: want ErrInvalidDeclaration, got %v", err)
	}
}
