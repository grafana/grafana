// Package converge computes, as a pure function, the ordered set of operations
// that makes a target system hold exactly the entities declared by a source
// system at a given version.
//
// It knows nothing about any particular source (version control, object store,
// configuration bundle, another API) or any particular target (API server,
// database, filesystem). The caller reads both sides into value types; this
// package does set arithmetic, identity resolution, container materialisation,
// budget admission and ordering; the caller executes, optionally with the
// helper in [github.com/grafana/grafana/pkg/converge/apply].
//
// # The contract
//
// For a source S at version V, the set of entities the target holds is a
// function of the content of S at V. It does not depend on the previous content
// of S, on the key an entity previously occupied, on what the target held
// before, or on which planning mode produced the plan.
//
// Four rules follow, and the package is shaped to make each one hard to break:
//
//   - A condition that permanently prevents a declared entity from being held
//     excludes that entity from the desired state: the plan removes it if
//     present, never writes it, and reports it. A transient condition is not a
//     verdict at all — it is an error that aborts planning before a plan exists.
//
//   - If deciding an entity's fate requires the previous key, the previous
//     target state, or a change list, the rule is wrong. [NewPlan] accordingly
//     takes no previous version and no previous inventory. There is no
//     parameter through which history could arrive.
//
//   - Narrowing the work with [WithHints] is an optimisation, never a
//     semantic. A hinted plan and a full plan over the same inputs converge on
//     the same target state.
//
//   - A plan carries the complete current exclusion set on every run, not the
//     exclusions discovered since the last one. Keys that were never entities
//     stay invisible.
//
// # Hierarchy
//
// Flat key/value reconciliation needs no library. What justifies one is that
// keys are hierarchical and the containers along them are materialised rather
// than declared: they are implied by the keys beneath them, they may carry an
// identity pinned by a declaration at a convention key, and they can be
// re-identified, relocated with identity intact, and orphaned. Ordering,
// re-parenting, orphan cleanup and the invariants that stop a container being
// removed out from under its contents all follow from that. See [ContainerConfig]
// and [Plan.Stages].
//
// # Shape of a use
//
//	plan, err := converge.NewPlan(desired, inventory,
//		converge.WithContainers(cfg),
//		converge.WithHints(hints),
//	)
//	if err != nil {
//		return err // transient: hold position, retry
//	}
//
//	// Authorisation, server dry-run, policy, human approval: all caller-side,
//	// all between planning and applying.
//	vetoes := authorize(plan)
//	plan, err = converge.Restrict(plan, vetoes)
//	if err != nil {
//		return err
//	}
//
//	res, err := apply.Run(ctx, plan, actuator, apply.Config{Workers: 10})
//	if res.Converged() {
//		advancePosition(version)
//	}
//
// # What this package is not
//
// It does not apply plans, read either side, decide what is valid, decide
// whether an operation is permitted, resolve conflicts, or track health. It
// has no third-party dependencies and performs no I/O, so a plan is a value:
// inspectable, serialisable, comparable, and safe to show a user before any of
// it runs.
package converge
