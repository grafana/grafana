# Stat v2 — experimental development guardrails

These instructions apply to this directory and its descendants, in addition to the
repository and panel instructions.

## Contributions

This directory is currently open to contributions from Grafana Labs employees
(Grafanistas) only. We are not accepting external contributions here. Pull requests
from non-Grafanistas that change this directory may be closed.

## Protect the running product

Isolation is the highest priority. Changes to this experiment must not change Stat
v1, other visualizations, or Grafana behavior when `dataviz.statRefresh` is disabled.
Keep the flag experimental and disabled by default.

- Keep experimental implementation changes in this directory.
- If a change requires modifying a component or utility in `@grafana/ui`,
  `@grafana/data`, or another shared package, first copy the necessary implementation
  into this directory and modify the local copy. This is "clone and own": Stat v2
  owns the copy while existing consumers continue using the shared implementation.
- Use the local BigValue and VizRepeater implementations. Do not route Stat v1 or
  other consumers to these experimental copies.
- Continue importing unchanged shared primitives where appropriate. Copy only what
  needs to evolve independently, including its necessary helpers and relevant tests.
- Do not change shared schemas, defaults, migrations, or panel options in a way that
  changes existing dashboards or prevents them from working with the flag disabled.
- Upstreaming changes to shared packages is a separate, deliberate task with a
  compatibility review and tests for existing consumers. Do not fold that work into
  a Stat v2 experiment.

## Preserve the lazy-loading boundary

Stat v2 development must not increase Grafana's base JavaScript bundle size.
Experimental code and its dependencies must stay behind the existing dynamic import
in `../module.tsx` and load only when the Stat v2 implementation is used.

- Do not add static runtime imports or re-exports of v2 code from the shared Stat
  entry point, shared packages, or other eagerly loaded modules.
- Use `import type` for type-only references across the lazy-loading boundary.
- Keep v2-only helpers, styles, and assets within the lazy-loaded dependency graph.
- When changing imports or dependencies, check that they do not pull experimental
  code into an existing bundle. Include bundle/build evidence in the PR when the
  loading boundary changes; a dynamic import alone does not prove isolation if
  another module imports the same code eagerly.

## Avoid new dependencies

Prefer existing dependencies and small local implementations. Do not add a new npm
dependency, upgrade a shared dependency, or change a lockfile as a routine shortcut
for this experiment. If a new dependency is necessary, explain why existing options
are insufficient and assess its bundle impact, license, and maintenance cost before
proposing it as a separate dependency change. It must not enter the base bundle.

## Verify isolation

Follow the inherited frontend and panel testing guidance. Run focused tests for the
changed local implementation and the Stat panel, including coverage for both v1 and
v2. For changes to flag selection, loading, or shared configuration, verify behavior
with `dataviz.statRefresh` both disabled and enabled. Report what was checked and any
remaining uncertainty in the PR; do not claim bundle or product isolation without
evidence.
