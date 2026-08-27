# Frontend features — agent guide

This tree contains Grafana visualization code (canvas, geo, dimensions, table, and more).
When you are adding or changing visualization code or its tests here, invoke these skills
with the Skill tool — each skill's own description states exactly when it applies:

- **`frontend-testing-strategy`** — general frontend test conventions: assert real behavior
  (not existence), honest test descriptions, avoiding AI-slop tests, and the anti-flake rules.
- **`panel-testing-strategy`** — builds on the above with what's specific to visualization
  code: the canvas draw-call snapshot harness and panel a11y/interaction-snapshot E2E.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX when making UI testable.
