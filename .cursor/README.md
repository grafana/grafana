# Cursor demo surfaces (Grafana fork)

Glance map for Rules / Hooks / Skills / Commands. Skip deep dives if the room already knows Cursor.

## Rules (noop — already in repo)

- `AGENTS.md` — always-on agent OS
- `CLAUDE.md` — `@AGENTS.md` redirect
- `public/app/features/alerting/unified/AGENTS.md` — glob-scoped domain rule
- `public/app/features/AGENTS.md` (+ ui/panel stubs) — skill routers

## Skills

- `.claude/skills/panel-testing-strategy/` — viz unit/E2E craft (**noop**)
- `.claude/skills/add-e2e-selectors/` — versioned `data-testid` wiring (**noop**)
- `.claude/skills/add-e2e-tests/` — Playwright suite conventions (**added**)

## Hooks

- `.cursor/hooks.json` → `afterFileEdit` audit + `beforeShellExecution` guard (**added**)
- `lefthook.yml` — git pre-commit gates (aside only; not Cursor Hooks)

## Commands (`/` menu)

- `/pr-ready` — Human Review Gates checklist before push
- `/fix-ci` — `gh` CI status / failing logs
- `/panel-test` — launcher into `panel-testing-strategy`
