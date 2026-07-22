# Mock plugin catalog

A standalone HTTP server that stands in for the grafana.com plugin catalog so a
local Grafana can list and install plugins with **zero real-network dependency**
(for plugin install/uninstall e2e tests). Scope: one app, one datasource, one
panel plugin.

Unlike the rest of `@grafana/test-utils`, this is **not** MSW: Grafana's Go
backend reaches it over the network via `GF_GRAFANA_COM_API_URL`, and that single
setting drives both the browser catalog metadata (`/api/gnet/*` proxy) and the
backend zip download.

## What's committed vs generated

`make-zips.sh` scaffolds three plugins with `@grafana/create-plugin` (defaults
kept), builds them, and produces two committed artifacts per plugin:

- `zips/<id>.zip` — the packaged plugin the backend downloads and installs.
- `meta/<id>.json` — the plugin's real `plugin.json`, which the server reads for
  catalog metadata (so it never needs the plugin sources at runtime).

The scaffolded sources themselves are **transient** — they're built in a temp dir
outside the repo and are not committed. Everything the
server needs lives in `zips/` and `meta/`.

## Run

```bash
# terminal 1 — serve the committed zips (no rebuild)
yarn workspace @grafana/test-utils mock-plugin-catalog
```

`server.mjs` prints the plugins it loaded and the exact env block to copy:

```bash
# terminal 2 — point Grafana at the mock and allow the unsigned test plugins.
# Use export: the inline `VAR=... make run` form does not propagate through
# make/air to the respawned backend process.
export GF_GRAFANA_COM_API_URL=http://localhost:8765
export GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-poc-app,grafana-poc-panel,grafana-pocds-datasource
make run
```

## Regenerating the zips

Only needed when you want to refresh the packaged plugins (e.g. new
`create-plugin` defaults).

```bash
yarn workspace @grafana/test-utils mock-plugin-catalog:build
```

This rebuilds `zips/` and `meta/` from scratch. The build runs entirely in a temp
dir outside the repo so it never touches the repo-root `.yarnrc.yml`.

## Verify (browserless)

```bash
curl -s localhost:8765/plugins | jq '.items | length'                           # => 3
curl -s -u admin:admin localhost:3000/api/gnet/plugins | jq '.items | length'   # => 3

ids=$(curl -s localhost:8765/plugins | jq -r '.items[].id')
for id in $ids; do
  curl -s -u admin:admin -X POST localhost:3000/api/plugins/$id/install -w " $id %{http_code}\n"
done                                                                            # => 200 each

first=$(echo "$ids" | head -1)
curl -s -u admin:admin localhost:3000/api/plugins/$first | jq '.enabled'
curl -s -u admin:admin -X POST localhost:3000/api/plugins/$first/uninstall -w " %{http_code}\n"
```
