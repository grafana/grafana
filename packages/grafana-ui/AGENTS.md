# @grafana/ui — agent guide

This package includes Grafana visualization components (Table, uPlot, VizLegend,
VizTooltip, Sparkline, gauges, and more). When you are adding or changing visualization
code or its tests here, invoke these skills with the Skill tool — each skill's own
description states exactly when it applies:

- **`frontend-testing-strategy`** — general frontend test conventions: assert real behavior
  (not existence), avoiding AI-slop tests, and the anti-flake rules.
- **`panel-testing-strategy`** — builds on the above with what's specific to visualization
  code: the canvas draw-call snapshot harness and panel a11y/interaction-snapshot E2E.
  Each skill links the Grafana-specific conventions in `contribute/testing-grafana-frontend.md`
  and `contribute/testing-grafana-panels.md`.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX.

## Component docs

Prefer an existing `@grafana/ui` component over a custom one. Read its MDX in
[`src/components/`](src/components/) before using it.

Keep everyday usage advice in the MDX. Add a `<Component>.guidance.md` next to the
component's MDX only if there is component-specific detail worth linking from the
MDX. Follow linked guides when they match your task. The MDX is enough for
ordinary usage.

Shared patterns live in [`src/guidance/patterns/`](src/guidance/patterns/):

- [Inline actions](src/guidance/patterns/inline-actions.md)
- [Icon and link actions](src/guidance/patterns/icon-and-link-actions.md): don't strip `Button` styling to fake a link or icon control
- [Interactive states](src/guidance/patterns/interactive-states.md): don't force hover, focus, disabled, invalid or selected looks with CSS
- [Styling a component's internal elements](src/guidance/patterns/styling-internals.md): don't restyle internals with `:nth-child` or `> div`

When you add or change a component, update its MDX using the
[component docs template](../../contribute/style-guides/component-docs-template.mdx).
