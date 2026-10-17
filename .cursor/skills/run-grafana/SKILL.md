---
name: run-grafana
description: >-
  Start a local Grafana development instance (Go backend + webpack frontend)
  on http://localhost:3000 with admin/admin. Use when the user runs
  /run-grafana, asks to start/run/boot Grafana locally, spin up the dev
  server, or open a local instance for manual testing.
disable-model-invocation: true
---

# Run local Grafana

Start (or reconnect to) a full local Grafana dev stack in this repo: backend
hot-reload via `make run`, frontend watch via `yarn start`. Default URL is
`http://localhost:3000/` with login `admin` / `admin`.

## One command

From the repository root, prefer the bundled script (idempotent; reuses existing
tmux sessions):

```bash
bash .claude/skills/run-grafana/scripts/start-local.sh
```

Stop:

```bash
bash .claude/skills/run-grafana/scripts/stop-local.sh
```

Flags:

- `--backend-only` — only `make run`
- `--frontend-only` — only `yarn start` (still installs deps if needed)
- `--no-install` — skip `yarn install --immutable` even if `node_modules` is missing

## Agent workflow

When this skill is invoked:

1. **Check** whether Grafana is already up:
   `curl -fsS http://127.0.0.1:3000/api/health`
2. If healthy, report the URL and credentials; do not restart unless the user
   asked for a restart.
3. Otherwise run `bash .claude/skills/run-grafana/scripts/start-local.sh`.
4. If the health wait times out, inspect tmux logs (`tmux capture-pane` /
   attach guidance) — first backend compile often needs several minutes.
5. Reply with:
   - URL: `http://localhost:3000/`
   - Login: `admin` / `admin`
   - How to attach: `tmux attach -t grafana-backend` / `grafana-frontend`
   - How to stop: the stop script above

Do **not** commit, push, or open a PR as part of this skill. Do not change
config files unless the user asks.

## Manual equivalent (no script)

Two terminals / two tmux sessions from repo root:

```bash
# Terminal A — backend
make run

# Terminal B — frontend (login shell recommended for pinned Node)
bash -lc 'yarn install --immutable && yarn start'
```

`make run-frontend` also installs JS deps then runs `yarn start`.

## Environment notes

- Read `references/local-dev.md` for timing, PATH/Node gotchas, and optional
  plugin watchers.
- No external database required (embedded SQLite).
- On Cursor Cloud agents, long-running processes **must** use tmux (the start
  script already does, including `/exec-daemon/tmux.portal.conf` when present).
- Never kill an unrelated setup/install process while starting Grafana.

## Optional extras (only if asked)

- Specific datasource plugin watch: `yarn workspace @grafana-plugins/<name> dev`
- Backing services: `make devenv sources=<name>`
- Restart cleanly: run the stop script, then the start script
