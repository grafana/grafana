---
name: panel-testing-strategy
description: Test visualization data, rendering, interactions, and accessibility with deterministic fixtures. Use alongside frontend-testing-strategy for chart and panel changes.
---

# Panel testing strategy

Read [frontend-testing-strategy](../frontend-testing-strategy/SKILL.md) if not already loaded.
Use the repository's visualization conventions supplied for the task. Do not reload guidance
already read. Use the existing rendering harness; do not import Grafana core-only helpers into
standalone plugins or prescribe one rendering engine to every repository.

- Use a consistent data builder per file and explicit overrides. Ensure field configuration reaches
  the real render path. When testing inference, supply raw inputs rather than pre-inferred fields.
- Pin data, absolute timestamps, timezone, dimensions, and randomness. Wait for renderer readiness.
- For canvas code, retain focused draw-call snapshots where the repository has a harness. Review
  changed drawing output; do not blindly regenerate baselines. Keep suites grouped by behavior.
- Preserve established visual regression and accessibility-tree snapshots for their intended
  contracts. They complement assertions about actual behavior; they do not replace them.
- Cover relevant empty data, nulls, multiple series, formatting, theme, and resize behavior.
- Exercise interactions such as tooltips, legend selection, filtering, sorting, and keyboard access.
  Scope selectors to the panel. Derive canvas interaction coordinates from deterministic geometry.
- Before accessibility scans, positively assert that the intended content rendered. Scan meaningful
  interaction states too. Document existing exceptions instead of silently suppressing violations.
- Add regression coverage at the cheapest layer that catches the bug. Report visual or browser
  checks that could not be run; do not invent a successful screenshot review.
