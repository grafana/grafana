# Colorshapes: a minimal App Platform app (learning exercise)

## Context

This is a learning exercise to understand how Grafana's App Platform ("apps/") works end
to end, following up on a conversation about `apps/secret` and `apps/example`. The goal is
a deliberately small, self-contained app — not a template for a "real" feature — that
exercises: a custom authenticated POST/GET endpoint, an app-owned SQL table (bypassing
unified storage, per earlier discussion about RDB-style time-range filtering), and a page
in Grafana's own web UI with the standard time range picker.

Decisions already made with the user (do not re-litigate):
- Storage: app's own SQL table on Grafana's managed DB engine (not unified storage/kinds),
  with an index on `created_at`.
- UI: a dedicated page, not a dashboard+datasource.
- Visibility: any authenticated user on the same Grafana instance sees all hits (no
  per-user filter). Confirmed with the user: cross-instance isolation is already structural
  (each Grafana instance/stack — e.g. a personal `<user>.grafana-dev.net` — has its own
  separate DB), so the risk of one user seeing another's data only exists *within* a
  single shared instance, and here that's the desired behavior, not a leak to guard
  against. We still record `created_by` per hit (useful to show in the table), just don't
  filter on it.
- Deploy to a real "dev" environment (via `deployment_tools`) is explicitly OUT of scope for
  this piece of work. We only make sure the app is inert by default (`served: false`), so it
  can never reach anything by accident. Promotion to a concrete environment is a follow-up.
- Requirements get written down in English in the repo, alongside the code, so they can be
  shown separately from the implementation.

## App identity

- New app directory: `apps/colorshapes/` (name/group easy to rename later if desired).
- API group: `colorshapes.grafana.app`, version `v0alpha1`, **`served: false`** by default
  (same convention as `apps/example` — dormant unless explicitly enabled via
  `runtime_config` in `custom.ini`, which is how we guarantee it never surfaces anywhere
  without an explicit opt-in).

## Backend

### 1. Manifest / CUE — `apps/colorshapes/kinds/manifest.cue`

Modeled on `apps/annotation/kinds/manifest.cue` (which defines a manifest-level POST route
with a `request.body` schema, independent of any kind's CRUD):

- `routes.namespaced["/hits"]["POST"]`: `request.body: {color: string, shape: string}`,
  response is a small ack object.
- `routes.namespaced["/hits"]["GET"]`: `request.query: {from?: string, to?: string}`
  (unix-ms strings), response `{items: [...{createdAt, sourceIp, color, shape}]}`.
- `kinds: []` if the schema allows an app with no managed kinds; otherwise one trivial
  placeholder kind. (Small implementation detail, resolved while coding — doesn't change
  anything else in the plan.)
- `make generate` (per-app Makefile, same as `apps/example/Makefile`) to produce Go types.

### 2. App code — `apps/colorshapes/pkg/app/`

- `app.go`: `New(cfg app.Config) (app.App, error)` wires `CustomRoutes`/
  `VersionedCustomRoutes` for `POST /hits` and `GET /hits` to handlers that close over a
  small store client (see below). Modeled on `apps/example/pkg/app/app.go`'s
  `ManagedKinds[...].CustomRoutes` wiring, but without needing a managed kind if `kinds: []`
  works.
- `routes.go`: handler signature
  `func(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error`
  (same shape as `apps/example/pkg/app/routes.go`'s `ExampleGetFooHandler`).
  - Auth/identity: `identity.GetRequester(ctx)` (package `pkg/apimachinery/identity`),
    exactly as done in `apps/dashvalidator/pkg/app/app.go:222-228`. `ctx` is the real
    request context, so this "just works" — no extra plumbing. If it errors, respond 401.
    Custom routes already sit behind Grafana's standard authn/authz chain (confirmed via
    `pkg/services/apiserver/auth/authenticator`), so unauthenticated callers are rejected
    before reaching the handler — no separate auth code needed for that part.
  - **Known limitation**: `app.CustomRouteRequest` does not expose the raw `*http.Request`
    or `RemoteAddr` — only `Headers`, `Method`, `URL`, `Body`, `ResourceIdentifier`. So
    `source_ip` can only come from `X-Forwarded-For`/`X-Real-Ip` headers, falling back to
    `"unknown"` if absent. A bare local `curl localhost:3000` with no reverse proxy in front
    won't have that header; a real proxied deployment normally would. This is an accepted
    trade-off of staying inside the App SDK's custom-route abstraction rather than dropping
    down to a classic `pkg/api` route — worth calling out, not silently hidden.
  - POST handler: decode `request.Body` JSON `{color, shape}`, validate non-empty, get IP
    per above, get user UID from identity (stored as `created_by`, not used to filter),
    call `store.Insert(...)`.
  - GET handler: parse `from`/`to` from `request.URL.Query()`, call `store.List(ctx, from, to)`
    — returns hits from all users on this instance, ordered by `created_at`.
- Register the installer: `pkg/registry/apps/colorshapes/register.go` (mirrors
  `pkg/registry/apps/example/register.go`), add to `pkg/registry/apps/wireset.go` and
  append unconditionally in `ProvideAppInstallers` (`pkg/registry/apps/apps.go`), same as
  `exampleAppInstaller` — `served: false` is what actually keeps it dormant, not this list.

### 3. Storage — own SQL table via the **core migration list** (not a bespoke migrator)

Explored both patterns this session:
- `apps/secret` uses a bespoke `contracts.SecretDBMigrator` + scoped migrator + manual Wire
  plumbing into `runner.go` — justified there because secrets need an isolated migration
  lifecycle/table locking. Overkill for us.
- The simple, already-automatic path (used e.g. by `short_url`): a plain migration file
  under `pkg/services/sqlstore/migrations/`, registered in `migrations.go`'s
  `AddMigration`, run unconditionally as part of Grafana's single core migration pass at
  startup (`pkg/services/sqlstore/sqlstore.go`) — no toggle, no extra wiring, works on
  `make run` immediately.

Plan: add `pkg/services/sqlstore/migrations/colorshapes_mig.go` modeled on
`short_url_mig.go`:
- Table `colorshape_hit`: `id` (pk), `created_at` (int64, unix ms), `source_ip` (varchar),
  `color` (varchar), `shape` (varchar), `created_by` (varchar — the requester's UID, stored
  for display only, not for access control).
- Index: on `created_at` (as requested, for the time-range filter).
- Register in `migrations.go`.

Repository — `apps/colorshapes/pkg/store/store.go`, consuming the shared `db.DB` (Wire-
injected, same service used everywhere via `pkg/infra/db`):
- `Insert(ctx, createdBy, sourceIP, color, shape string) error`
- `List(ctx, from, to time.Time) ([]Hit, error)` — `WHERE created_at BETWEEN ? AND ?`,
  ordered by `created_at`, no user filtering (any authenticated user on the instance sees
  all rows, per the visibility decision above).
- Test `store_test.go`: basic coverage of `Insert`/`List` and the time-range filtering
  boundaries (rows outside `[from, to)` excluded).

## Frontend

Checked: no App Platform app in this repo currently ships a working self-registered nav
page — `apps/*/plugin/src` only contains generated TS types (for kinds), not a
`plugin.json`/`module.tsx`. Building this as a real installable app-plugin is heavier
(separate packaging/install, not part of the core webpack bundle — `public/app/plugins/`
only has `datasource/` and `panel/` categories). So instead we add the page as a **core
Grafana feature**, the same way `playlists` does it (a real, working, already-bundled
pattern):

- `public/app/features/colorshapes/ColorshapesPage.tsx`:
  - `TimeRangePicker` (`@grafana/ui`) or `TimePickerWithHistory`
    (`public/app/core/components/TimePicker/TimePickerWithHistory.tsx`) bound to local
    state, default range `now-1h` to `now`.
  - On mount / range change: `getBackendSrv().fetch({ url: '/apis/colorshapes.grafana.app/v0alpha1/namespaces/default/hits', params: { from: range.from.valueOf(), to: range.to.valueOf() } })`
    via `lastValueFrom` (same pattern as `public/app/features/apiserver/discovery.ts`).
  - Render results in `@grafana/ui`'s `Table`/`InteractiveTable` with columns Created At /
    Created By / Source IP / Color / Shape. `Created By` shows who generated each hit,
    since the table itself isn't filtered by viewer.
- Route: add to `public/app/routes/routes.tsx` (`path: '/colorshapes'`, lazy import).
- Nav item: add an entry in `public/app/core/navtree/` so it shows up in the left nav for
  the logged-in user (exact section decided while implementing, based on the simplest
  existing analogous entry).

## Requirements doc

Write `apps/colorshapes/REQUIREMENTS.md` in English, capturing the functional
requirements settled on in conversation (endpoint contract, auth model, storage model +
index, visibility model + why it's instance-wide rather than per-user, UI, dev/prod
stance, the source-IP header limitation) — so it can be shown separately from the
implementation, as requested.

## Running it locally

- `custom.ini`:
  ```
  [grafana-apiserver]
  runtime_config = colorshapes.grafana.app/v0alpha1=true
  ```
- `make run` (backend, hot reload) + `yarn start` (frontend).
- Log in as usual (`admin`/`admin` locally), open the new nav item, `curl` the POST
  endpoint with a session cookie (or basic auth) to generate hits, watch them show up
  filtered by the time range picker.

## Verification

- `go test ./apps/colorshapes/... ./pkg/services/sqlstore/migrations/...`, including
  `store_test.go`'s coverage of insert/list and time-range boundaries.
- `make gen-cue` after CUE edits, `make gen-go` (Wire) after registering the installer,
  `make build-backend` as a sanity build.
- Manual: run locally as above; confirm an unauthenticated `curl` (no cookie/token) gets
  401; confirm a second logged-in user on the same local instance can see the first user's
  hits (expected, per the visibility decision).
