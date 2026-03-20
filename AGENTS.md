# AGENTS.md

<!-- version: 2.0.0 -->

This file provides guidance to AI agents when working with code in the Grafana repository.

**Directory-scoped agent files exist for specialized areas — read them when working in those directories:**

- `docs/AGENTS.md` — Documentation style guide (for work under `docs/`)
- `public/app/features/alerting/unified/AGENTS.md` — Alerting squad patterns

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

## Cursor Cloud specific instructions

### Prerequisites

- **Node.js v24.x** (see `.nvmrc` for exact version). Use `nvm install` / `nvm use` to match.
- **Go 1.25.7** (see `go.mod`). Pre-installed in the VM.
- **Yarn 4.11.0** via corepack (bundled in `.yarn/releases/`). Run `corepack enable` if `yarn` is not found.
- **GCC** required for CGo/SQLite compilation of the backend.

### Running services

- **Backend**: `make run` — builds and starts Grafana backend with hot-reload (air) on `localhost:3000`. Default login: `admin`/`admin`. First build takes ~3 minutes due to debug symbols (`-gcflags all=-N -l`); subsequent hot-reload rebuilds are faster.
- **Frontend**: `yarn start` — starts webpack dev server that watches for changes. The backend proxies to it. First compile takes ~45s.
- No external databases required — Grafana uses embedded SQLite by default.

### Testing gotchas

- **Frontend tests**: The `yarn test` script includes `--watch` by default. Always use `yarn jest --no-watch` or add `--watchAll=false` to run tests once and exit.
- **Backend tests**: Some packages (e.g. `pkg/api/`) have slow test compilation (~2 min) due to large dependency graphs. Use targeted test runs with `-run TestName` where possible.
- All standard build/test/lint commands are documented in the Commands section above.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **grafana** (124658 symbols, 503611 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/grafana/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool             | When to use                   | Command                                                                 |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `query`          | Find code by concept          | `gitnexus_query({query: "auth validation"})`                            |
| `context`        | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})`                              |
| `impact`         | Blast radius before editing   | `gitnexus_impact({target: "X", direction: "upstream"})`                 |
| `detect_changes` | Pre-commit scope check        | `gitnexus_detect_changes({scope: "staged"})`                            |
| `rename`         | Safe multi-file rename        | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher`         | Custom graph queries          | `gitnexus_cypher({query: "MATCH ..."})`                                 |

## Impact Risk Levels

| Depth | Meaning                               | Action                |
| ----- | ------------------------------------- | --------------------- |
| d=1   | WILL BREAK — direct callers/importers | MUST update these     |
| d=2   | LIKELY AFFECTED — indirect deps       | Should test           |
| d=3   | MAY NEED TESTING — transitive         | Test if critical path |

## Resources

| Resource                                 | Use for                                  |
| ---------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/grafana/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/grafana/clusters`       | All functional areas                     |
| `gitnexus://repo/grafana/processes`      | All execution flows                      |
| `gitnexus://repo/grafana/process/{name}` | Step-by-step execution trace             |

## Self-Check Before Finishing

Before completing any code modification task, verify:

1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
