# Rendering an app plugin's OpenAPI spec offline

For plugin authors who want the spec their manifest produces, and for anyone changing how
that spec is built. The short version:

```sh
grafana cli write-openapi ./dist/app-sdk-manifest.json -o ./specs
```

writes one `<version>.json` per served version into `./specs`, each identical to what a
running Grafana serves at `/openapi/v3/apis/<group>/<version>` — without starting the
server, opening a database, or launching the plugin backend.

## What you can point it at

**A manifest file.** No Grafana config is read and no plugin needs to be installed, so this
works inside a plugin's own build. When a `plugin.json` sits in the same directory — what a
built plugin looks like — it is loaded too, and the spec matches the server exactly. Without
it, the manifest's `appName` stands in for the plugin id and the plugin version is absent
from `info.x-grafana-plugin`. Everything else is the same document — the APIs are served
under the group the manifest declares either way.

**An installed plugin's id**, optionally with a version:

```sh
grafana cli --config conf/custom.ini --homepath "$PWD" \
  write-openapi grafana-app-sdk-test-app/v1alpha1 -o spec.json
```

The plugin is found the way the server finds it — the plugin paths in the config file, plus
the CLI's `--pluginsDir` — so point `--config` at the config the server uses.

## Where it writes

Naming a single version writes a single spec, to `-o <file>` or to stdout. Otherwise every
served version is written into the `-o <directory>`, which is created if it doesn't exist.
That set always includes the `v0alpha1` settings API, which every app plugin serves whether
or not its manifest mentions the version.

## How the spec is built

`Build` in [spec.go](spec.go) assembles the same pipeline the server does, and nothing else:

1. `appplugin.NewAppPluginAPIBuilder` over the loaded plugin definition, with the plugin
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

Because step 3 registers storage it never reads, the spec describes the API as unified
storage serves it. That is the one known difference from a running server: on a deployment
where the settings resource is still served from legacy storage, the server's `v0alpha1`
spec carries two fewer unused component schemas (`WatchEvent` and `RawExtension`), because
legacy storage cannot watch. No path refers to them in either spec.

## Keeping it honest

The value of this command is that it agrees with the server, and the only way to be sure is
to compare. With a plugin installed and `appplugins.registerAPIServer` on:

```sh
curl -s -u admin:admin \
  http://localhost:3000/openapi/v3/apis/<pluginID>/<version> | python3 -m json.tool --indent 2 > server.json
grafana cli --config conf/custom.ini --homepath "$PWD" write-openapi <pluginID>/<version> -o cli.json
diff <(python3 -m json.tool --indent 2 cli.json) server.json
```

The CLI output is indented because it is read and diffed by people; the HTTP response is
not, so both sides need normalizing before the diff means anything.

Rendering from the manifest instead (`write-openapi ./dist/app-sdk-manifest.json -o ./specs`)
produces the same bytes, as long as the `plugin.json` is beside it.
