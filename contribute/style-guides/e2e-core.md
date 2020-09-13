# End-to-End Tests for core Grafana

This document is specific to the [Grafana repository](https://github.com/grafana/grafana). Be sure that you've read the [generalized E2E document](e2e.md).

## Commands

- `yarn e2e` Creates an isolated `grafana-server` home under _\<repo-root>/e2e/tmp_ with provisioned data sources and dashboards. This copies locally build binary and frontend assets from your repo root so you need to have a built backend and frontend for this to run locally. The server starts on port 3001 so it does not conflict with your normal dev server.
- `yarn e2e:debug` Same as above but runs the tests in chrome and does not shutdown after completion.
- `yarn e2e:dev` Same as above but does not run any tests on startup. It lets you pick a test first.

If you already have a Grafana instance running, you can provide a specific URL by setting the `BASE_URL` environment variable:

```shell
BASE_URL=http://172.0.10.2:3333 yarn e2e
```

The above commands use some utils scripts under [_\<repo-root>/e2e_](../../e2e) that can also be used for more control.

- `./e2e/start-server` This creates a fresh new grafana server working dir, setup's config and starts the server. It will also kill any previously started server that is still running using pid file at _\<repo-root>/e2e/tmp/pid_.
- `./e2e/wait-for-grafana` waits for `$HOST` and `$PORT` to be available. Per default localhost and 3001.
- `./e2e/run-suite <debug|dev|noarg>` Starts cypress in different modes.

## Test suites

All the integration tests are located at _\<repo-root>/e2e/suite\<x>/specs_. The page objects and reusable flows are in the [_\<repo-root>/packages/grafana-e2e_](../../packages/grafana-e2e) package.  
