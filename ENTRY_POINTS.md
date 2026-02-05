# Grafana Entry Points

Quick reference for locating key starting points in the codebase.
Links to existing READMEs and guides provide additional context.

## Backend

### Bootstrap

- `pkg/cmd/grafana/main.go` - CLI entry
- `pkg/server/server.go` - Server initialization
- `pkg/setting/setting.go` - Configuration

**See:** [Backend Developer Guide](contribute/backend/README.md)

### HTTP Layer

- `pkg/api/api.go` - Route registration
- `pkg/middleware/` - HTTP middleware

**See:** [Communication Patterns](contribute/backend/communication.md)

### Services

Core services in `pkg/services/`:

- `alerting/` - Alert evaluation and notifications
- `auth/` - Authentication
- `dashboards/` - Dashboard CRUD
- `datasources/` - Data source management
- `live/` - Real-time features
- `login/` - Login flows
- `pluginsintegration/` - Plugin lifecycle
- `provisioning/` - Config-as-code
- `rendering/` - Image rendering
- `sqlstore/` - Database layer
- `store/` - Unified storage

**See:** [Service Architecture](contribute/backend/services.md), [Package Hierarchy](contribute/backend/package-hierarchy.md)

### Storage

- `pkg/services/sqlstore/sqlstore.go` - DB interface
- `pkg/services/sqlstore/migrations/` - Schema migrations

**See:** [Database Guide](contribute/backend/database.md)

---

## Frontend

### Bootstrap

- `public/app/index.tsx` - React entry
- `public/app/AppWrapper.tsx` - App wrapper
- `public/app/routes/routes.tsx` - Routing

**See:** [Frontend Style Guide](contribute/style-guides/frontend.md)

### State

- `public/app/store/configureStore.ts` - Redux store
- `public/app/core/services/context_srv.ts` - User context
- `public/app/core/services/backend_srv.ts` - HTTP client

**See:** [Redux Guide](contribute/style-guides/redux.md)

### Features

Key features in `public/app/features/`:

- `dashboard/` - Dashboard viewer/editor
- `panel/` - Panel framework
- `explore/` - Ad-hoc queries
- `datasources/` - Data source config
- `alerting/` - Alerting UI
- `plugins/` - Plugin management
- `query/` - Query editor framework
- `variables/` - Dashboard variables

### Packages

Reusable packages in `packages/`:

- `grafana-ui/` - UI components → [README](packages/grafana-ui/README.md)
- `grafana-data/` - Data utilities → [README](packages/grafana-data/README.md)
- `grafana-runtime/` - Runtime services → [README](packages/grafana-runtime/README.md)
- `grafana-schema/` - Type definitions → [README](packages/grafana-schema/README.md)

**See:** [Package Overview](packages/README.md), [Theming Guide](contribute/style-guides/themes.md)

---

## Plugins

### Backend

- `pkg/plugins/manager/manager.go` - Plugin manager
- `pkg/tsdb/` - Data source plugin implementations

### Frontend

- `public/app/features/plugins/loader.ts` - Plugin loader
- `public/app/plugins/datasource/` - Built-in data sources
- `public/app/plugins/panel/` - Built-in panels

**See:** Plugin development guides in relevant datasource/panel directories

---

## Testing

- Backend: `*_test.go` files, `pkg/tests/`
- Frontend: `*.test.ts(x)` files
- E2E: `e2e-playwright/`

**See:** [Testing Guide](contribute/style-guides/testing.md), [E2E Guide](contribute/style-guides/e2e-playwright.md)

---

## Build

- `Makefile` - Build targets
- `package.json` - Frontend scripts
- `scripts/` - Build automation
- `devenv/` - Local development environment

**See:** [Developer Guide](contribute/developer-guide.md), [Workflow Guide](WORKFLOW.md)

---

## Architecture

**See:** [Architecture Overview](contribute/architecture/README.md), [Frontend Data Requests](contribute/architecture/frontend-data-requests.md), [K8s-Inspired Backend](contribute/architecture/k8s-inspired-backend-arch.md)

---

**More documentation:** [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), [/contribute/](contribute/)
