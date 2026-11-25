# Testing contributions

When writing or reviewing frontend tests, read the
[frontend testing strategy](../.claude/skills/frontend-testing-strategy/SKILL.md) if not already loaded.
For visualization tests, also read the
[panel testing strategy](../.claude/skills/panel-testing-strategy/SKILL.md).
Each skill links the Grafana-specific sections listed below.

## Commands

To run existing tests, use [AGENTS.md, Test](../AGENTS.md#test) and
[Testing gotchas](../AGENTS.md#testing-gotchas). Type-checking commands are in
[Lint & Format](../AGENTS.md#lint--format). Do not load the skills just to run a test.
For Playwright server setup, read only
[Running Playwright E2E tests](testing-grafana-frontend.md#running-playwright-e2e-tests).

## Read only the applicable adapter section

In [Grafana frontend conventions](testing-grafana-frontend.md):

- "Mocking and feature flags" for typed mocks or flag-dependent branches.
- "Anti-flake rules" for unstable async or E2E tests.
- "When to add which tests (by SDLC phase)" when planning release coverage.

In [Grafana panel conventions](testing-grafana-panels.md):

- "Step 1 — Set up data with the repo's builders" for panel fixtures and field configuration.
- "Step 2 — HTML5 canvas / rendering panels: use the draw-call snapshot harness" for canvas tests.
- "Step 3 — E2E for interaction, accessibility, and interaction snapshots" for panel E2E tests.
- "Canvas / uPlot anti-flake rules" for unstable rendering tests.

## Provenance

[shared-testing-source.json](../.claude/skills/shared-testing-source.json) records the source and
hashes of the skills. Update it when changing them.
