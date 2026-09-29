# Panels — agent guide

Built-in visualization panels live here. When adding or changing panel code — and
especially its tests — invoke these skills with the Skill tool:

- **`frontend-testing-strategy`** — general frontend test conventions: assert real behavior
  (not existence), avoiding AI-slop tests, and the anti-flake rules. Read it before writing or
  reviewing any test here.
- **`panel-testing-strategy`** — builds on the above with what's specific to panels: the
  panel-props/data-frame builders, the canvas draw-call snapshot harness, and panel a11y/
  interaction-snapshot E2E.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX when making panel UI testable.
