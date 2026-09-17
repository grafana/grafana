# Colorshapes — requirements

A learning exercise to understand Grafana's App Platform ("apps/") end to end, built as a
small, self-contained app rather than a template for a "real" feature.

## Functional requirements

1. **Ingest endpoint.** A POST endpoint that accepts a JSON body with exactly two keys,
   both strings: `color` and `shape`.
2. **Storage.** Each hit is stored as a row with four fields: `created_at` (server-side
   timestamp), `source_ip` (caller's IP), `color`, `shape`. The table also records
   `created_by` (the authenticated user), used for display, not for access control.
3. **Authentication.** The endpoint must be authenticated with the caller's Grafana user —
   no anonymous access.
4. **Web UI.** The stored hits are viewable in Grafana's own web UI, as a table, filterable
   by `created_at` using the standard Grafana time range picker widget.
5. **Visibility.** Any authenticated user on the same Grafana instance can see all hits (no
   per-user filter). Rationale: each Grafana instance/stack (e.g. a personal
   `<user>.grafana-dev.net`) already has its own separate database, so cross-instance
   isolation is structural. The only case where a per-user filter would matter is several
   different people sharing one running instance, and here that's the desired behavior,
   not a leak to guard against.
6. **Deploy posture.** The app must never reach production by accident. It's disabled by
   default (`served: false` on its API version) and only enabled locally via an explicit
   `custom.ini` override. Deploying it to a real "dev" environment (via `deployment_tools`)
   is explicitly out of scope for this piece of work — a separate, deliberate follow-up.
7. **Local runnability.** Must be runnable and testable entirely on a local `make run` +
   `yarn start`, without any external environment.

## Known limitations / accepted trade-offs

- **Source IP is best-effort.** The App SDK's custom-route request object doesn't expose
  the raw connection's `RemoteAddr` — only HTTP headers. `source_ip` is read from
  `X-Forwarded-For` / `X-Real-Ip`, falling back to `"unknown"`. A bare local `curl` with no
  reverse proxy in front will record `"unknown"`; a real proxied deployment normally
  populates this correctly.
- **No left-nav entry.** The page is reachable at `/colorshapes` but isn't wired into
  Grafana's left navigation. The nav tree's static ordering is explicitly documented as
  load-bearing (`public/app/core/navtree/constants.ts`: it must stay in lockstep with
  weights mirrored from `pkg/services/navtree/models.go`), and the sanctioned extension
  point (`addNavEntries`) needs an eager, pre-store-creation call site that isn't
  demonstrated anywhere in this OSS checkout to copy safely. Given the exploratory scope,
  this was left out rather than risk destabilizing a shared, parity-sensitive system.

## Out of scope

- Deploying to any real environment (dev, ops, or prod).
- Any RBAC/authorization finer than "authenticated user of this instance."
