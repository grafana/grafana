# Frontend features — agent guide

This tree contains Grafana visualization code (canvas, geo, dimensions, table, and more).
When you are adding or changing visualization code or its tests here, invoke these skills
with the Skill tool — each skill's own description states exactly when it applies:

- **`panel-testing-strategy`** — how visualization unit + E2E tests should be written:
  assert real behavior (not existence), the canvas draw-call snapshot harness, honest
  test descriptions, and the anti-flake rules.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX when making UI testable.
