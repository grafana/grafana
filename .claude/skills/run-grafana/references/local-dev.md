# Local Grafana runbook (quick reference)

## Commands

| Goal | Command |
| ---- | ------- |
| Backend + hot reload | `make run` |
| Frontend watch | `yarn start` (or `make run-frontend`) |
| Install JS deps | `yarn install --immutable` |
| Both via skill script | `.claude/skills/run-grafana/scripts/start-local.sh` |
| Stop both | `.claude/skills/run-grafana/scripts/stop-local.sh` |

## Access

- URL: http://localhost:3000/
- Default login: `admin` / `admin`
- Health: `curl -fsS http://127.0.0.1:3000/api/health`

## Timing

- First backend build with debug symbols can take ~3 minutes.
- First frontend webpack compile ~45s.
- Subsequent hot reloads are much faster.

## Cursor Cloud PATH gotcha

Infra may inject `/exec-daemon/node` ahead of nvm. Prefer a **login shell** for yarn/webpack:

```bash
bash -lc 'yarn start'
```

## Optional plugin watchers

Only if editing these plugins:

- azuremonitor
- grafana-testdata-datasource

```bash
yarn workspace @grafana-plugins/<name> dev
# or
yarn plugin:build:dev
```

## Backing services

Default SQLite is enough. For external sources:

```bash
make devenv sources=influxdb
```
