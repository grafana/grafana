# Testing contributions

Read the checked-in [frontend testing strategy](../.claude/skills/frontend-testing-strategy/SKILL.md).
For chart rendering and interactions, also read the
[panel testing strategy](../.claude/skills/panel-testing-strategy/SKILL.md).
These Markdown guides require no agent installation or private access. Local commands and fixtures
below specialize those principles. Provenance and content hashes live in
[shared-testing-source.json](../.claude/skills/shared-testing-source.json); publication of the shared
source is pending. Update shared copies together through reviewed PRs, preserving the [root license](../LICENSE).

## Grafana core adapter

Read [Grafana frontend conventions](testing-grafana-frontend.md) for core-only feature flags,
mock APIs, full-query assertions, selectors, lifecycle coverage, and test-server behavior.
For panels, read [Grafana panel conventions](testing-grafana-panels.md) for data builders,
field overrides, canvas harnesses, accessibility fixtures, and interaction snapshots.

Use `pnpm test <path> --watchAll=false` for focused unit tests. Use
`pnpm e2e:playwright <spec>` with `GRAFANA_URL` unset for the harness-managed server.
Use `pnpm typecheck` when changed types require it. Follow AGENTS.md before changing an existing branch.
