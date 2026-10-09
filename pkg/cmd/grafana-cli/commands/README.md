# write-openapi

Render OpenAPI v3 from one app-sdk manifest file without starting Grafana, opening
a database, or launching the plugin backend. No Grafana configuration or installed
plugin is required.

```bash
grafana cli write-openapi ./app-sdk-manifest.json -o ./openapi
```

This writes one `<group>-<version>.json` file per served manifest version into the
output directory. Unserved versions and legacy settings APIs are excluded.

Select one version to write a single file:

```bash
grafana cli write-openapi ./app-sdk-manifest.json --api-version v1alpha1 -o spec.json
```

Omit `-o` when selecting a version to write JSON to stdout. Without
`--api-version`, `-o` must name a directory. Flags may appear before or after the
manifest path. Installed plugin IDs are not accepted as targets.

If `plugin.json` is beside the manifest, its ID, description, version, and build
metadata are included in the spec. Otherwise the manifest's `appName` supplies
the plugin ID. The API group always comes from the named manifest.

## Docker

Use an image containing this command and override its server entrypoint:

```bash
docker run --rm --entrypoint grafana --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work grafana/grafana:<version> \
  cli write-openapi ./app-sdk-manifest.json -o ./openapi
```

Paths are relative to the container's working directory. The output appears in
the mounted host directory.

## Output

JSON is indented two spaces, with `<`, `>`, and `&` left unescaped. The spec is
requested from the same handler that serves `/openapi/v3/apis/<group>/<version>`.
Generated specs enable search, trash, and hybrid route registration; per-kind
eligibility rules still apply.

See [pluginroute](../../../services/pluginsintegration/pluginroute/README.md#rendering-the-spec-offline)
for how the spec is rendered and how to compare it with a running server.
