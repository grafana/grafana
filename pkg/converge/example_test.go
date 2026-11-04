package converge_test

import (
	"fmt"

	"github.com/grafana/grafana/pkg/converge"
)

// folders is the configuration of a target whose containers are implied by
// entity keys and carry an identity derived from the key unless the source
// pins one.
func folders() converge.ContainerConfig {
	return converge.ContainerConfig{
		Implied:          true,
		FallbackIdentity: func(k converge.Key) converge.Identity { return converge.Identity("auto:" + string(k)) },
	}
}

// A file renamed onto a key the target cannot address stops being a
// declaration, so what it used to declare is removed and the new key is
// reported. Both halves matter: silence here is what sends users looking for a
// dashboard that no longer exists.
func ExampleNewPlan_exclusion() {
	plan, err := converge.NewPlan(
		[]converge.Declaration{
			{Key: "team/overview.json", Fingerprint: "h1"},
			{Key: "team/Backend & UI.json", Verdict: converge.Excluded, Reason: "unaddressable-key"},
		},
		[]converge.Observation{
			{Key: "team/", Identity: "auto:team/", Container: true},
			{Key: "team/overview.json", Identity: "D1", Fingerprint: "h1"},
			{Key: "team/dashboard.json", Identity: "D2", Fingerprint: "h2"},
		},
		converge.WithContainers(folders()),
		converge.WithMoveDetection(false),
	)
	if err != nil {
		panic(err)
	}

	for _, op := range plan.Ops {
		fmt.Printf("%s %s\n", op.Kind, op.Key)
	}
	for _, e := range plan.Exclusions {
		fmt.Printf("excluded %s: %s\n", e.Key, e.Reason)
	}
	// Output:
	// delete team/dashboard.json
	// excluded team/Backend & UI.json: unaddressable-key
}

// Containers are materialised from the keys beneath them, and the plan's
// stages put them in the only order that is safe.
func ExampleNewPlan_hierarchy() {
	plan, err := converge.NewPlan(
		[]converge.Declaration{{Key: "a/b/c.json", Fingerprint: "h1"}},
		nil,
		converge.WithContainers(folders()),
	)
	if err != nil {
		panic(err)
	}

	for i, stage := range plan.Stages {
		for _, op := range stage {
			fmt.Printf("stage %d: %s %s\n", i, op.Kind, op.Key)
		}
	}
	// Output:
	// stage 0: ensure-container a/
	// stage 1: ensure-container a/b/
	// stage 2: create a/b/c.json
}

// A relocation is derived from content, not from anyone's claim that a rename
// happened, so an identity survives a move without the planner being told.
func ExampleNewPlan_move() {
	plan, err := converge.NewPlan(
		[]converge.Declaration{{Key: "a/new.json", Fingerprint: "h1"}},
		[]converge.Observation{
			{Key: "a/", Identity: "auto:a/", Container: true},
			{Key: "a/old.json", Identity: "D1", Fingerprint: "h1"},
		},
		converge.WithContainers(folders()),
	)
	if err != nil {
		panic(err)
	}

	for _, op := range plan.Ops {
		fmt.Printf("%s %s -> %s (keeps %s)\n", op.Kind, op.From, op.Key, op.Identity)
	}
	// Output:
	// move a/old.json -> a/new.json (keeps D1)
}

// A single interactive write is a plan of one or two operations. Planning it
// as a plan is what gives the write path the same authorisation pass as a bulk
// convergence run: the container the write lands in is in the plan, with the
// provenance of its identity, so a permission check sees the inherited
// permissions that actually govern it.
func ExampleNewPlan_targeted() {
	plan, err := converge.NewPlan(
		[]converge.Declaration{{Key: "team/new.json", Fingerprint: "h9"}},
		[]converge.Observation{{Key: "team/", Identity: "F-TEAM", Container: true}},
		// No FallbackIdentity: an interactive write does not get to decide
		// what identity a container it did not create should carry.
		converge.WithContainers(converge.ContainerConfig{Implied: true}),
		converge.WithHints(converge.HintSet{Keys: []converge.Key{"team/new.json"}, Complete: true}),
		converge.WithExclusionScope(converge.ScopeTargeted),
	)
	if err != nil {
		panic(err)
	}

	for _, op := range plan.Ops {
		fmt.Printf("%s %s in %s (identity %s, %s)\n",
			op.Kind, op.Key, op.Container, op.ContainerIdentity, op.ContainerProvenance)
	}
	// Output:
	// create team/new.json in team/ (identity F-TEAM, inventory)
}

// Vetoing an operation removes everything that depended on it, so a plan
// narrowed by an authorisation pass is still coherent rather than merely
// smaller.
func ExampleRestrict() {
	plan, err := converge.NewPlan(
		[]converge.Declaration{
			{Key: "open/a.json", Fingerprint: "h1"},
			{Key: "locked/b.json", Fingerprint: "h2"},
		},
		nil,
		converge.WithContainers(folders()),
	)
	if err != nil {
		panic(err)
	}

	var vetoes []converge.Veto
	for _, op := range plan.Ops {
		if op.Kind == converge.OpEnsureContainer && op.Key == "locked/" {
			vetoes = append(vetoes, converge.Veto{Ref: op.Ref(), Reason: "forbidden"})
		}
	}

	restricted, err := converge.Restrict(plan, vetoes)
	if err != nil {
		panic(err)
	}
	for _, op := range restricted.Ops {
		fmt.Printf("%s %s\n", op.Kind, op.Key)
	}
	for _, e := range restricted.Exclusions {
		fmt.Printf("excluded %s: %s\n", e.Key, e.Reason)
	}
	// Output:
	// ensure-container open/
	// create open/a.json
	// excluded locked/: forbidden
	// excluded locked/b.json: converge/vetoed-dependency
}
