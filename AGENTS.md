# AGENTS.md

<!-- version: 2.0.0 -->

This file provides guidance to AI agents when working with code in the Grafana repository.

**Directory-scoped agent files exist for specialized areas — read them when working in those directories:**

- `docs/AGENTS.md` — Documentation style guide (for work under `docs/`)
- `public/app/features/alerting/unified/CLAUDE.md` — Alerting squad patterns

## Project Overview

Grafana is a monitoring and observability platform. Go backend, TypeScript/React frontend, monorepo with Yarn workspaces (frontend) and Go workspaces (backend).

## Principles

- Follow existing patterns in the surrounding code
- Write tests for new functionality
- Keep changes focused — avoid over-engineering
- Separate PRs for frontend and backend changes (deployed at different cadences)
- Security: prevent XSS, SQL injection, command injection

## Commands

### Build & Run

```bash
make run                          # Backend with hot reload (localhost:3000, admin/admin)
make build-backend                # Backend only
yarn start                        # Frontend dev server (watches for changes)
yarn build                        # Frontend production build
```

### Test

```bash
# Backend
go test -run TestName ./pkg/services/myservice/   # Specific test
make test-go-unit                                  # All unit tests
make test-go-integration                           # Integration tests

# Frontend
yarn test path/to/file                             # Specific file
yarn test -t "pattern"                             # By name pattern
yarn test -u                                       # Update snapshots

# E2E
yarn e2e:playwright path/to/test.spec.ts           # Specific test
```

### Lint & Format

```bash
make lint-go                      # Go linter
yarn lint                         # ESLint
yarn lint:fix                     # ESLint auto-fix
yarn prettier:write               # Prettier auto-format
yarn typecheck                    # TypeScript check
```

### Code Generation

```bash
make gen-go                       # Wire DI (after changing service init)
make gen-cue                      # CUE schemas (after changing kinds/)
make gen-apps                     # App SDK apps
make swagger-gen                  # OpenAPI/Swagger specs
make gen-feature-toggles          # Feature flags (pkg/services/featuremgmt/)
make i18n-extract                 # i18n strings
make update-workspace             # Go workspace (after adding modules)
```

### Dev Environment

```bash
yarn install --immutable                          # Install frontend deps
make devenv sources=postgres,influxdb,loki        # Start backing services
make devenv-down                                  # Stop backing services
make lefthook-install                             # Pre-commit hooks
```

## Architecture

### Backend (`pkg/`)

| Directory         | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `pkg/api/`        | HTTP API handlers and routes                                |
| `pkg/services/`   | Business logic by domain (alerting, dashboards, auth, etc.) |
| `pkg/server/`     | Server init and Wire DI setup (`wire.go`)                   |
| `pkg/tsdb/`       | Time series database query backends                         |
| `pkg/plugins/`    | Plugin system and loader                                    |
| `pkg/infra/`      | Logging, metrics, database access                           |
| `pkg/middleware/` | HTTP middleware                                             |
| `pkg/setting/`    | Configuration management                                    |

**Patterns**: Wire DI (regenerate with `make gen-go`), services implement interfaces in same package, business logic in `pkg/services/<domain>/` not in API handlers, database via `sqlstore`, plugin communication via gRPC/protobuf.

### Frontend (`public/app/`)

| Directory              | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `public/app/core/`     | Shared services, components, utilities                |
| `public/app/features/` | Feature code by domain (dashboard, alerting, explore) |
| `public/app/plugins/`  | Built-in plugins (many are Yarn workspaces)           |
| `public/app/types/`    | TypeScript type definitions                           |
| `public/app/store/`    | Redux store configuration                             |

**Patterns**: Redux Toolkit with slices (not old Redux), function components with hooks, Emotion CSS-in-JS via `useStyles2`, RTK Query for data fetching, React Testing Library for tests.

### Shared Packages (`packages/`)

`@grafana/data` (data structures), `@grafana/ui` (components), `@grafana/runtime` (runtime services), `@grafana/schema` (CUE-generated types), `@grafana/scenes` (dashboard framework).

### Backend Apps (`apps/`)

Standalone Go apps using Grafana App SDK: `apps/dashboard/`, `apps/folder/`, `apps/alerting/`.

### Plugin Workspaces

These built-in plugins require separate build steps: `azuremonitor`, `cloud-monitoring`, `grafana-postgresql-datasource`, `loki`, `tempo`, `jaeger`, `mysql`, `parca`, `zipkin`, `grafana-pyroscope-datasource`, `grafana-testdata-datasource`.

Build a specific plugin: `yarn workspace @grafana-plugins/<name> dev`

## Key Notes

- **Wire DI**: Backend service init changes require `make gen-go`. Wire catches circular deps at compile time.
- **CUE schemas**: Dashboard/panel schemas in `kinds/` generate both Go and TS code via `make gen-cue`.
- **Feature toggles**: Defined in `pkg/services/featuremgmt/`, auto-generate code. Run `make gen-feature-toggles` after changes.
- **Go workspace**: Defined in `go.work`. Run `make update-workspace` when adding Go modules.
- **Build tags**: `oss` (default), `enterprise`, `pro`.
- **Config**: Defaults in `conf/defaults.ini`, overrides in `conf/custom.ini`.
- **Database migrations**: Live in `pkg/services/sqlstore/migrations/`. Test with `make devenv sources=postgres_tests,mysql_tests` then `make test-go-integration-postgres`.
- **CI sharding**: Backend tests use `SHARD`/`SHARDS` env vars for parallelization.
