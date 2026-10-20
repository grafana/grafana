# demo-manifest-app

A proof of concept for the router's namespaced API groups
(`pkg/router/specs/2026-10-16-router-namespaced-groups.md`). Not for production.

The app serves one kind, `Kind`, in `demomanifestapp.ext.grafana.app`. Each `Kind` object names an
API group and a kind:

```json
{ "spec": { "apiGroup": "shop", "name": "Widget" } }
```

The backend's cluster-scoped `_manifests` route lists one manifest per namespace and `apiGroup`,
with a kind for each `Kind` object, in the group `<apiGroup>.<namespace>.demomanifestapp.ext.grafana.app`.
The router polls the route and serves the groups, so the object above in `default` makes
`/apis/shop.default.demomanifestapp.ext.grafana.app/v1/namespaces/default/widgets` available
within a poll or so. The declared kinds have a spec of `title` and `description`.

The app's page (Apps > Demo manifest app) lists, creates, edits and deletes `Kind` objects.

## Run it

Build the plugin into `dist/`:

```bash
make -C demo-manifest-app build
```

Then load it in Grafana from this repository (`make run`) with this in `conf/custom.ini`:

```ini
[feature_toggles]
appplugins.loadAppManifest = true
appplugins.registerAPIServer = true
grafana.useRouterMiddleware = true

[cloud_router]
namespaced_groups = demomanifestapp.ext.grafana.app

[plugin.demo-manifest-app]
path = <repo>/demo-manifest-app/dist
```

The plugin is unsigned, which development mode permits, and auto-enabled.

```bash
G=http://admin:admin@localhost:3000
curl -s -X POST $G/apis/demomanifestapp.ext.grafana.app/v1alpha1/namespaces/default/kinds \
  -H 'Content-Type: application/json' \
  -d '{"apiVersion":"demomanifestapp.ext.grafana.app/v1alpha1","kind":"Kind","metadata":{"name":"shop-widget"},"spec":{"apiGroup":"shop","name":"Widget"}}'
curl -s $G/apis/demomanifestapp.ext.grafana.app/v1alpha1/_manifests | jq .
curl -s $G/apis | jq -r '.groups[].name' | grep demomanifestapp
curl -s $G/apis/shop.default.demomanifestapp.ext.grafana.app/v1/namespaces/default/widgets
```

## Develop

The plugin is its own Go module and npm package, outside the repository's Go and Yarn
workspaces; the Makefile sets `GOWORK=off`. It was scaffolded with `@grafana/create-plugin` and
`add experimental-app-sdk`.

- `make generate` regenerates the code and `src/app-sdk-manifest.json` from `kinds/`.
  A kind named `Kind` makes the generator emit a Go type and a func both named `Kind`, so
  `.config/app-sdk/rename-kind-func.mjs` renames the func to `KindKind` afterwards.
- `make test` runs the Go tests, the type check and the linter.

The `_manifests` handler lists `Kind` objects as the plugin itself, across every namespace, with
the credentials Grafana gives the plugin process (the local plugin token exchange). It returns
pages of `limit` manifests, with an offset as the `continue` token.
