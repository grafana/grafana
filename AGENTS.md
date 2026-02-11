# AGENTS.md

<!-- version: 1.3.0 -->

This file provides guidance to AI agents when working with code in the Grafana repository.

## Project Overview

Grafana is a monitoring and observability platform with a Go backend and TypeScript/React frontend. The project uses a monorepo structure with Yarn workspaces for frontend packages and Go workspaces for backend modules.

## General Role and Context

Act as an experienced full-stack software engineer working on Grafana. Act as an experienced tech writer when creating documentation.

Grafana consists of:

- **Backend**: Go microservices with dependency injection (Wire), serving REST APIs and managing data sources
- **Frontend**: TypeScript/React application with Redux Toolkit state management and Emotion styling
- **Plugins**: Extensible datasource and panel plugins, some built-in as Yarn workspaces
- **Documentation**: everything under /docs fuels the grafana.com website.

When contributing code, prioritize:

- Following existing patterns in the codebase
- Writing tests for new functionality
- Keeping changes focused and minimal (avoid over-engineering)
- Security (prevent XSS, SQL injection, command injection, etc.)

## Common Development Commands

### Backend (Go)

```bash
# Build and run backend with hot reload
make run

# Build backend only
make build-backend

# Run backend tests
make test-go-unit
make test-go-integration

# Run specific backend tests with sharding
make test-go-unit SHARD=1 SHARDS=4

# Generate Wire dependency injection code
make gen-go

# Lint backend code
make lint-go
```

### Frontend (TypeScript/React)

```bash
# Install dependencies (use --immutable for CI)
yarn install --immutable

# Start frontend dev server (watches for changes)
yarn start

# Build production frontend
yarn build

# Run frontend tests
yarn test
yarn test:coverage

# Lint frontend code
yarn lint
yarn lint:fix

# Typecheck
yarn typecheck

# Build and watch all plugins
yarn plugin:build:dev

# Build and watch specific plugin
yarn workspace <plugin-name> dev
```

### End-to-End Tests

```bash
# Run Playwright e2e tests
yarn e2e:playwright

# Run specific Playwright test
yarn e2e:playwright path/to/test.spec.ts

# Show last HTML report
yarn playwright show-report
```

### Code Generation

```bash
# Generate all code (CUE schemas, Wire, apps)
make gen-cue
make gen-go
make gen-apps

# Generate OpenAPI/Swagger specs
make swagger-gen

# Generate feature toggles
make gen-feature-toggles

# Extract i18n strings
make i18n-extract
```

### Database Integration Tests

```bash
# Start test databases
make devenv sources=postgres_tests,mysql_tests

# Run PostgreSQL integration tests
make test-go-integration-postgres

# Run MySQL integration tests
make test-go-integration-mysql
```

### Docker

```bash
# Build Docker image
make build-docker-full

# Build Ubuntu-based Docker image
make build-docker-full-ubuntu
```

## Architecture Overview

### Backend Structure (`pkg/`)

- **`pkg/api/`**: HTTP API handlers and routes. Main REST API endpoints live here.
- **`pkg/services/`**: Core business logic organized by domain (e.g., `alerting`, `dashboards`, `datasources`, `auth`).
- **`pkg/server/`**: Application server initialization and Wire dependency injection setup.
- **`pkg/tsdb/`**: Data source query backends for time series databases.
- **`pkg/plugins/`**: Plugin system and plugin loader.
- **`pkg/infra/`**: Infrastructure concerns like logging, metrics, database access.
- **`pkg/middleware/`**: HTTP middleware (auth, rate limiting, etc.).
- **`pkg/setting/`**: Configuration management and settings.
- **`pkg/registry/`**: Kubernetes-style API registries for unified storage.

Services use dependency injection via Wire. Wire provider sets are defined in `pkg/server/wire.go` (OSS) and `pkg/server/enterprise_wire.go` (Enterprise).

### Frontend Structure (`public/app/`)

- **`public/app/core/`**: Core application code, services, components, and utilities.
- **`public/app/features/`**: Feature-specific code organized by domain (e.g., `alerting`, `dashboard`, `explore`, `panel`).
- **`public/app/plugins/`**: Built-in panel plugins, datasource plugins organized as Yarn workspaces.
- **`public/app/types/`**: TypeScript type definitions.
- **`public/app/store/`**: Redux store configuration.
- **`public/app/routes/`**: Application routing.

Frontend uses Redux Toolkit for state management and React Router for routing. Each feature typically has its own state slice.

### Workspace Organization

**Frontend packages** (`packages/`): Shared libraries published to npm:
- `@grafana/data`: Core data structures, transformations
- `@grafana/ui`: React component library
- `@grafana/runtime`: Runtime services and APIs
- `@grafana/schema`: TypeScript schemas generated from CUE
- `@grafana/scenes`: Dashboard/panel framework

**Backend apps** (`apps/`): Standalone Go apps using Grafana App SDK:
- `apps/dashboard/`: Dashboard API service
- `apps/folder/`: Folder API service
- `apps/alerting/`: Alerting services

**Plugins as workspaces**: Many built-in plugins in `public/app/plugins` are Yarn workspaces requiring separate build steps.

### Key Architectural Patterns

**Backend**:
- Dependency injection via Wire (generate with `make gen-go`)
- Services implement interfaces and are registered in Wire provider sets
- Database access through `sqlstore` with migration system
- Plugin communication via gRPC/protobuf

**Frontend**:
- Redux Toolkit for state management (avoid old Redux patterns)
- React Hooks preferred over class components
- Emotion CSS-in-JS for styling
- Monaco editor for code editing
- uPlot for time series visualization

### Testing Philosophy

- **Unit tests**: Fast, isolated, no external dependencies
- **Integration tests**: Test with real databases, marked with `TestIntegration` prefix
- **E2E tests**: Playwright tests in `e2e-playwright/`
- Frontend tests use Jest + React Testing Library
- Backend tests use standard Go testing

## When Working on Backend (Go) Code

### Key Patterns

- **Dependency injection**: Services use Wire for compile-time DI. After modifying service initialization, regenerate with `make gen-go`
- **Service interfaces**: Services implement interfaces defined in the same package (e.g., `pkg/services/auth/service.go` defines both interface and implementation)
- **Database access**: Use `sqlstore` package for database operations. Migrations live in `pkg/services/sqlstore/migrations/`
- **HTTP handlers**: API handlers live in `pkg/api/`, grouped by domain
- **Business logic**: Core logic lives in `pkg/services/<domain>/`, not in API handlers

### Testing

- Use standard Go testing (`testing` package)
- Integration tests must be prefixed with `TestIntegration` and use build tag `// +build integration`
- Mock external dependencies using interfaces
- Use `sqlstore` test helpers for database tests

### Running Specific Tests

Use Go's `-run` flag for specific tests:
```bash
go test -run TestSpecificFunction ./pkg/services/myservice/
```

## When Working on Frontend (TypeScript/React) Code

### Key Patterns

- **State management**: Use Redux Toolkit (RTK) with slices. Avoid old Redux patterns (action creators, redux-thunk directly)
- **Components**: Prefer function components with hooks over class components
- **Styling**: Use Emotion CSS-in-JS with theme tokens from `@grafana/ui`
- **Data fetching**: Use RTK Query or React Query for API calls
- **Testing**: Use React Testing Library. Avoid testing implementation details; test user behavior

### Plugin Development

Many built-in plugins in `public/app/plugins` are Yarn workspaces requiring separate builds:
- `azuremonitor`, `cloud-monitoring`, `grafana-postgresql-datasource`, `loki`, `tempo`, `jaeger`, `mysql`, `parca`, `zipkin`, `grafana-pyroscope-datasource`, `grafana-testdata-datasource`

When working on these plugins, run `yarn workspace <plugin-name> dev` to watch and rebuild.

### Running Specific Tests

Use Jest's pattern matching:
```bash
yarn test -t "test name pattern"
yarn test path/to/test/file
```

## When Working on Tests

### Backend Tests

```bash
# Run specific test
go test -run TestFunctionName ./pkg/services/myservice/

# Run with race detector
go test -race ./pkg/...

# Run integration tests for specific database
make test-go-integration-postgres
```

### Frontend Tests

```bash
# Run specific test file
yarn test path/to/test.spec.ts

# Run tests matching pattern
yarn test -t "test name pattern"

# Update snapshots
yarn test -u
```

### E2E Tests

```bash
# Run all Playwright tests
yarn e2e:playwright

# Run specific test
yarn e2e:playwright tests/path/to/test.spec.ts

# Show last report
yarn playwright show-report
```

## When Working on Code Generation

Grafana uses several code generation systems:

```bash
# Generate Wire DI code (after changing service initialization)
make gen-go

# Generate CUE schemas (after changing kinds in kinds/)
make gen-cue

# Generate Grafana App SDK apps (after changing app definitions)
make gen-apps

# Generate OpenAPI/Swagger specs
make swagger-gen

# Generate feature toggle code (after modifying feature flags)
make gen-feature-toggles

# Extract i18n strings (after adding new translatable strings)
make i18n-extract
```

**Important**: After running code generation, verify changes with `git diff` to ensure generated code is correct.

## When Working on Database Schemas or Migrations

- Migrations live in `pkg/services/sqlstore/migrations/`
- Create new migrations using the migration framework
- Test migrations with both SQLite, PostgreSQL, and MySQL:
  ```bash
  make devenv sources=postgres_tests,mysql_tests
  make test-go-integration-postgres
  make test-go-integration-mysql
  ```

## Important Development Notes

### Wire Dependency Injection

Backend changes to service initialization often require regenerating Wire code:
```bash
make gen-go
```

Wire detects circular dependencies and generates compile-time errors if the dependency graph is invalid. Ensure services are structured to avoid cycles.

### Go Workspace

Grafana uses Go workspaces defined in `go.work`. When adding new Go modules, update the workspace with:
```bash
make update-workspace
```

### CUE Code Generation

Grafana uses CUE for schema definitions (kinds) that generate Go and TypeScript code:
```bash
make gen-cue
```

Dashboard and panel schemas live in `kinds/` and generate code for both backend and frontend.

### Feature Toggles

Feature flags are defined in `pkg/services/featuremgmt/` and auto-generate code. After modifying feature definitions, run:
```bash
make gen-feature-toggles
```

### Pre-commit Hooks

Install lefthook for pre-commit linting and formatting:
```bash
make lefthook-install
```

This keeps `eslint-suppressions.json` in sync and auto-formats code.

### Development Environment Setup

1. Install dependencies: Go 1.25+, Node.js 22+, GCC (for CGo)
2. Enable corepack: `corepack enable && corepack install`
3. Install frontend deps: `yarn install --immutable`
4. Run backend: `make run`
5. Run frontend: `yarn start`
6. Access at http://localhost:3000 (admin/admin)

### Docker Development Environment

Start backing services (databases, etc.) for development:
```bash
make devenv sources=postgres,mysql,influxdb,loki
```

Stop services:
```bash
make devenv-down
```

Available sources are in `devenv/docker/blocks/`.

### Configuration

Default config: `conf/defaults.ini`
Custom config: `conf/custom.ini` (create this file, only override what you need)

Enable development mode in `custom.ini`:
```ini
app_mode = development
```

## Build Tags

Grafana supports build tags for different editions:
- `oss`: Open source only (default)
- `enterprise`: Enterprise features
- `pro`: Professional features

Most development uses `oss` builds by default.

## CI/CD Notes

- CI runs sharded backend tests using `SHARD` and `SHARDS` environment variables
- Frontend packages are built with `yarn packages:build`
- Plugin bundles are built with `yarn plugin:build`
- Test sharding improves CI parallelization

## When Working on Documentation

<!-- docs-ai-begin -->

Instructions for documentation authoring in Markdown files within the `docs/` directory or other documentation areas.

### Documentation Role

Act as an experienced software engineer and technical writer for Grafana Labs when working on documentation.

Write for software developers and engineers who understand general programming concepts.

Focus on practical implementation and clear problem-solving guidance.

#### Grafana Product Naming

Use full product names on first mention, then short names:

- Grafana Alloy (full), Alloy (short)
- Grafana Beyla (full), Beyla (short)

Use "OpenTelemetry Collector" on first mention, then "Collector" for subsequent references.
Keep full name for distributions, headings, and links.

Always use "Grafana Cloud" in full.

Use complete terms:

- "OpenTelemetry" (not "OTel")
- "Kubernetes" (not "K8s")

Present observability signals in order: metrics, logs, traces, and profiles.

Focus content on Grafana solutions when discussing integrations or migrations.

### Documentation Style

#### Structure

Structure articles into sections with headings.

Leave Markdown front matter content between two triple dashes `---`.

The front matter YAML `title` and the content h1 (#) heading should be the same.
Make sure there's an h1 heading in the content; this redundancy is required.

Always include copy after a heading or between headings, for example:

```markdown
## Heading

Immediately followed by copy and not another heading.

## Sub heading
```

The immediate copy after a heading should introduce and provide an overview of what's covered in the section.

Start articles with an introduction that covers the goal of the article. Example goals:

- Learn concepts
- Set up or install something
- Configure something
- Use a product to solve a business problem
- Troubleshoot a problem
- Integrate with other software or systems
- Migrate from one thing to another
- Refer to APIs or reference documentation

Follow the goal with a list of prerequisites, for example:

```markdown
Before you begin, ensure you have the following:

- <Prerequisite 1>
- <Prerequisite 2>
- ...
```

Suggest and link to next steps and related resources at the end of the article, for example:

- Learn more about A, B, C
- Configure X
- Use X to achieve Y
- Use X to achieve Z
- Project homepage or documentation
- Project repository (for example, GitHub, GitLab)
- Project package (for example, pip or NPM)

You don't need to use the "Refer to..." syntax for next steps; use the link text directly.

#### Copy

Write simple, direct copy with short sentences and paragraphs.

Use contractions:

- it's, isn't, that's, you're, don't

Choose simple words:

- use (not utilize)
- help (not assist)
- show (not demonstrate)

Write with verbs and nouns. Use minimal adjectives except when describing Grafana Labs products.

#### Tense

Write in present simple tense.

Avoid present continuous tense.

Only write in future tense to show future actions.

#### Voice

Always write in an active voice.

Change passive voice to active voice.

#### Perspective

Address users as "you".

Use second person perspective consistently.

#### Wordlist

Use allowlist/blocklist instead of whitelist/blacklist.

Use primary/secondary instead of master/slave.

Use "refer to" instead of "see", "consult", "check out", and other phrases.

#### Formatting

Use sentence case for titles and headings.

Use inline Markdown links: [Link text](https://example.com).

Link to other sections using descriptive phrases that include the section name:
"For setup details, refer to the [Lists](#lists) section."

Bold text with two asterisks: **bold**

Emphasize text with one underscore: _italics_

Format UI elements using sentence case as they appear:

- Click **Submit**.
- Navigate to **User settings**.
- Configure **Alerting rules**.

#### Lists

Write complete sentences for lists:

- Works with all languages and frameworks (correct)
- All languages and frameworks (incorrect)

Use dashes for unordered lists.

Bold keywords at list start and follow with a colon.

#### Images

Include descriptive alt text that conveys the essential information or purpose.

Write alt text without "Image of..." or "Picture of..." prefixes.

#### Code

Use single code backticks for:

- user input
- placeholders in markdown, for example _`<PLACEHOLDER_NAME>`_
- files and directories, for example `/opt/file.md`
- source code keywords and identifiers,
  for example variables, function and class names
- configuration options and values, for example `PORT` and `80`
- status codes, for example `404`

Use triple code backticks followed by the syntax for code blocks, for example:

```javascript
console.log('Hello World!');
```

Introduce each code block with a short description.
End the introduction with a colon if the code sample follows it, for example:

```markdown
The code sample outputs "Hello World!" to the browser console:

<CODE_BLOCK>
```

Use descriptive placeholder names in code samples.
Use uppercase letters with underscores to separate words in placeholders,
for example:

```sh
OTEL_RESOURCE_ATTRIBUTES="service.name=<SERVICE_NAME>
OTEL_EXPORTER_OTLP_ENDPOINT=<OTLP_ENDPOINT>
```

The placeholder includes the name and the less than and greater than symbols,
for example <PLACEHOLDER_NAME>.

If the placeholder is markdown emphasize it with underscores,
for example _`<PLACEHOLDER_NAME>`_.

In code blocks use the placeholder without additional backticks or emphasis,
for example <PLACEHOLDER_NAME>.

Provide an explanation for each placeholder,
typically in the text following the code block or in a configuration section.

Follow code samples with an explanation
and configuration options for placeholders, for example:

```markdown
<CODE_BLOCK>

This code sets required environment variables
to send OTLP data to an OTLP endpoint.
To configure the code refer to the configuration section.

<CONFIGURATION>
```

Put configuration for a code block after the code block.

### APIs

When documenting API endpoints specify the HTTP method,
for example `GET`, `POST`, `PUT`, `DELETE`.

Provide the full request path, using backticks.

Use backticks for parameter names and example values.

Use placeholders like `{userId}` for path parameters, for example:

- To retrieve user details, make a `GET` request to `/api/v1/users/{userId}`.

#### CLI commands

When presenting CLI commands and their output,
introduce the command with a brief explanation of its purpose.
Clearly distinguish the command from its output.

For commands, use `sh` to specify the code block language.

For output, use a generic specifier like `text`, `console`,
or `json`/`yaml` if the output is structured.

For example:

```markdown
To list all running pods in the `default` namespace, use the following command:

<CODE_BLOCK>
```

The output will resemble the following:

```text
NAME                               READY   STATUS    RESTARTS   AGE
my-app-deployment-7fdb6c5f65-abcde   1/1     Running   0          2d1h
another-service-pod-xyz123           2/2     Running   0          5h30m
```

#### Shortcodes

Leave Hugo shortcodes in the content when editing.

Use our custom admonition Hugo shortcode for notes, cautions, or warnings,
with `<TYPE>` as "note", "caution", or "warning":

```markdown
{{< admonition type="<TYPE>" >}}
...
{{< /admonition >}}
```

Use admonitions sparingly.
Only include exceptional information in admonitions.

<!-- docs-ai-end -->
