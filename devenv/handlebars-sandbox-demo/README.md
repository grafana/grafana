# Live Handlebars CSP demo

The demo is configured for **http://localhost:3011**, bound to loopback, with anonymous viewing.
Both backend and frontend are built from worktree commit
`487e20516bc5431f4d00ebd35b9b81d2c4e00702` plus the sandbox changes.

- [Comparison dashboard](http://localhost:3011/d/handlebars-csp-comparison): nonce-compiled
  Handlebars succeeds; standard Text v2 Handlebars succeeds; XY threshold colors fail;
  XY continuous-gradient colors succeed.
- [Live-query dashboard](http://localhost:3011/d/handlebars-csp-live): real TestData queries
  refresh every five seconds, and the Environment dropdown updates template output.

`conf/custom.ini` enables enforced CSP and omits `unsafe-eval` from `script-src`.
It also disables inline scripts without a nonce. `font-src data:` permits the existing
Text sandbox's inlined fonts; it does not authorize script execution.
The initial demo admin is `admin` / `admin`; viewing needs no login.

The failing XY panel uses the threshold-color path in `fieldValueColors`, which constructs
functions with `new Function`. The fix in
[PR #127330](https://github.com/grafana/grafana/pull/127330) is deliberately not applied.
The same points render using continuous colors, which do not need eval.

## Integration

All Text v2 Handlebars templates use the execution sandbox, including editor previews and
per-row rendering. No marker is required. The second comparison panel uses the real
`variableValue` helper; the first uses parent-side variable interpolation.

The backend and frontend watcher were stopped to free memory. The commands below restart them.

## Start again

From this worktree, after installing dependencies:

```sh
cp devenv/handlebars-sandbox-demo/custom.ini.example conf/custom.ini
make build-backend
```

Build TestData assets if absent:

```sh
yarn workspace @grafana-plugins/grafana-testdata-datasource build
```

In one terminal, using the Node version from `.nvmrc`:

```sh
NODE_ENV=dev node node_modules/@rspack/cli/bin/rspack.js build --config scripts/rspack/rspack.boot.ts --env develop
NODE_ENV=dev NODE_OPTIONS=--max-old-space-size=8192 node node_modules/@rspack/cli/bin/rspack.js build --config scripts/rspack/rspack.dev.ts --watch --env noTsCheck=1 --env noLint=1
```

In another:

```sh
./bin/grafana server --homepath "$PWD" --config "$PWD/conf/custom.ini"
```

Disk-based Rspack watch is intentional: Grafana ignores `frontend_dev.server_url` when CSP is
on. Reload the browser after source changes. Database, logs, screenshots, and browser traces
are isolated under `data/handlebars-sandbox-demo`.

This session reused the original checkout's installed dependencies and copied its built TestData
assets (external symlinks are rejected by the core plugin scanner). The backend was rebuilt in
this worktree.

## Verification

```sh
node node_modules/@playwright/test/cli.js test --config devenv/handlebars-sandbox-demo/playwright.config.ts
```

All four live-server checks passed on 2026-10-27. They verify the actual response CSP, rendered data,
standard Text rendering, XY `fieldValueColors` eval error, continuous XY canvas, automatic
query refresh, variable changes, paginated templates, and unsaved editor drafts through the dashboard UI. Screenshots:
`data/handlebars-sandbox-demo/comparison.png` and `data/handlebars-sandbox-demo/live.png`.
The separate cross-browser sandbox suite remains available through
`playwright.handlebars-sandbox.config.ts`.

The worktree reuses installed dependencies from the original checkout. Its workspace links
point at that checkout, so default typechecking can report mismatches with latest-main source.
Validation should resolve workspace packages from this worktree before interpreting those errors.
