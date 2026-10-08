# Rendering an app plugin's OpenAPI spec offline

For plugin authors who want the spec their manifest produces, and for anyone changing how
that spec is built. The short version:

```sh
grafana cli write-openapi ./dist/app-sdk-manifest.json -o ./specs
```

writes one `<group>-<version>.json` file per served version into `./specs`, using the same
OpenAPI builder as `/openapi/v3/apis/<group>/<version>` — without starting the server,
opening a database, or launching the plugin backend.

## What you can point it at

**A manifest file.** No Grafana config is read and no plugin needs to be installed, so this
works inside a plugin's own build. When a `plugin.json` sits in the same directory — what a
built plugin looks like — it is loaded too. Without it, the manifest's `appName` stands in
for the plugin ID and the plugin version is absent from `info.x-grafana-plugin`. The APIs
are served under the group declared by the manifest either way.

To select one version from the manifest:

```sh
grafana cli write-openapi ./dist/app-sdk-manifest.json --api-version v1alpha1 -o spec.json
```

Installed plugin IDs are not command targets.

## Where it writes

Selecting a single version with `--api-version` writes a single spec, to `-o <file>` or to stdout. Otherwise every
served version is written into the `-o <directory>`, which is created if it doesn't exist.
Only served versions from the named manifest are rendered; settings APIs are excluded.

## How the spec is built

`Build` in [spec.go](spec.go) assembles the same pipeline the server does, and nothing else:

1. `pluginroute.NewAPI` over the plugin ID and selected manifest, with the plugin
   client, the plugin context, the decrypter and access control stubbed — none of them
   contribute to the spec.
2. `builder.SetupConfig`, which installs the OpenAPI definitions and, more importantly, the
   post-processors: `getOpenAPIPostProcessor` (hiding the watch and all-namespace routes)
   and the builder's own `PostProcessOpenAPI` (the settings schema, the manifest kind
   schemas, the request examples).
3. A `GenericAPIServer` with a no-op `RESTOptionsGetter`, so the resource handlers are
   installed and the paths they serve exist. No request is ever routed to them.
4. `builder3.BuildOpenAPISpecFromRoutes` over the group version's web service, which is what
   `routes.OpenAPI.InstallV3` does for each `/openapi/v3/apis/...` endpoint.

## Deliberate rendering choices

The generated contract always enables search, trash and hybrid route registration. No Grafana configuration is loaded. The usual per-kind eligibility rules still apply: trash is limited to dashboards, and hybrid requires `search.hybrid: true` on a namespaced kind in a served version.

Step 3 also describes the API as unified storage serves it. On a deployment where the
settings resource still uses legacy storage, the generated `v0alpha1` spec carries two
additional unused component schemas (`WatchEvent` and `RawExtension`), because legacy
storage cannot watch. No path refers to them in either spec.

## Keeping it honest

The value of this command is that it agrees with the server, and the only way to be sure is
to compare. With the plugin manifest API served by the router:

```sh
curl -s -u admin:admin \
  http://localhost:3000/openapi/v3/apis/<group>/<version> | python3 -m json.tool --indent 2 > server.json
grafana cli write-openapi ./dist/app-sdk-manifest.json --api-version <version> -o cli.json
diff <(python3 -m json.tool --indent 2 cli.json) server.json
```

The CLI output is indented because it is read and diffed by people; the HTTP response is
not, so both sides need normalizing before the diff means anything.

When comparing output, account for the deliberate rendering choices above and normalize
formatting as shown.
