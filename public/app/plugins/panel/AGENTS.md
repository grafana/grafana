# Panels — agent guide

Built-in visualization panels live here. When adding or changing panel code — and
especially its tests — invoke these skills with the Skill tool:

- **`panel-testing-strategy`** — how the DataViz squad wants panel/viz unit + E2E
  tests written: assert real behavior (not existence), the canvas draw-call snapshot
  harness, and the anti-flake rules. Read it before writing or reviewing panel tests.
- **`add-e2e-selectors`** — add versioned `@grafana/e2e-selectors` and wire
  `data-testid` into JSX when making panel UI testable.
