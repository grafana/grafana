# @grafana/ui — agent guide

This package includes Grafana visualization components (Table, uPlot, VizLegend,
VizTooltip, Sparkline, gauges, and more). When you are adding or changing visualization
code or its tests here, invoke these skills with the Skill tool — each skill's own
description states exactly when it applies:

- **`panel-testing-strategy`** — DataViz squad conventions for viz unit + E2E tests:
  assert real behavior (not existence), the canvas draw-call snapshot harness, and the
  anti-flake rules.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX.
