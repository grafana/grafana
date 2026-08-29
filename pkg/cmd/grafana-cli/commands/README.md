# write-openapi

Renders the OpenAPI v3 spec an app plugin's API server serves, without starting Grafana.

It is the offline equivalent of downloading `/openapi/v3/apis/<pluginID>/<version>` from a
running server: the same builder, the same schemas, the same routes. Use it to commit a
spec alongside a plugin, to generate clients in a plugin's build, or to review what a
manifest change does to the API before shipping it.

```
grafana cli write-openapi <manifest.json | pluginID[/version]> [-o <path>]
```

The CLI is a subcommand of the one `grafana` binary — `grafana cli <command>` — not a
separate executable. Global flags such as `--homepath` belong to `cli`, so they go before
`write-openapi`.

## From a manifest file

This is the form to use in a plugin's own build. It reads the manifest directly and needs
no Grafana config, no `--homepath`, and no installed plugin:

```bash
grafana cli write-openapi ./app-sdk-manifest.json -o ./openapi
```

```
Wrote openapi/v1alpha1.json for example.ext.grafana.app/v1alpha1
Wrote openapi/v0alpha1.json for example.ext.grafana.app/v0alpha1
```

**`-o` is required here, and it must name a directory.** A manifest target always renders
every served version, one `<version>.json` per file — there is no way to name a single
version or write to stdout. That is because a plugin serves more than its manifest
declares: `v0alpha1` carries the settings API, and it is served alongside the manifest's
own versions whether or not the manifest mentions it. Passing `-o spec.json` is refused
rather than silently writing one of them.

### plugin.json is picked up when it is there

If a `plugin.json` sits in the same directory as the manifest — which is what a built
plugin looks like — it is loaded too, and the spec then matches what a real server serving
that plugin returns: the plugin's id, description, version, and settings schema.

Without it, the manifest's `appName` stands in for the plugin id and the settings API falls
back to its defaults. The manifest kinds are identical either way, so a manifest on its own
is fine for reviewing a schema change; point at a built plugin directory's manifest when
the spec is a deliverable.

If the manifest has no `appName` **and** there is no `plugin.json` to take an id from, the
command fails rather than inventing one.

## From an installed plugin

Naming a plugin id looks it up the way the server does, which needs the config that says
where plugins live. Unlike the manifest form, this one can name a single version and write
it to stdout:

```bash
grafana cli --homepath /usr/share/grafana write-openapi my-app/v1alpha1
```

Point at a plugin that is not in the config's plugin paths — one under development — with
`--pluginsDir`:

```bash
grafana cli --homepath $PWD --pluginsDir ./plugins write-openapi my-app/v1alpha1 -o spec.json
```

Leaving the version off writes every one of them to `-o <directory>`. Leaving off both the
version and `-o` tells you which versions exist rather than guessing:

```
my-app serves v1alpha1, v0alpha1: pass -o <directory> to write them all, or name one version
```

## Docker

The `grafana` binary is on `PATH` in every image variant, but the entrypoint is the server
launcher, so it has to be overridden:

```bash
docker run --rm \
  --entrypoint grafana \
  --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work \
  grafana/grafana:<version> \
  cli write-openapi ./app-sdk-manifest.json -o ./openapi
```

The image's entrypoint is `/run.sh`, which starts the server and ignores anything you pass
it, so `--entrypoint grafana` is required. Note `cli` as the first argument after the image
name: the entrypoint is the `grafana` binary, so the subcommand path is `cli write-openapi`.

Two things worth knowing:

- **`--user`.** The image runs as uid `472`. On a Linux host that uid is what writes into
  your bind mount, so the output lands owned by `472` or fails outright. Docker Desktop on
  macOS and Windows maps ownership back to you and hides this, so the flag is harmless
  there and necessary on Linux — pass it and the command behaves the same everywhere.
- **Paths are container paths.** `-o ./openapi` is relative to `-w /work`, so it appears in
  the current directory on the host. An absolute host path will not resolve.

The manifest form is the one worth running in a container, because it needs nothing from
the image but the binary. The plugin-id form needs the plugin mounted where the config
looks for it, and **`--homepath` becomes mandatory**: it defaults to the working directory,
and `-w /work` has just moved that away from `/usr/share/grafana`. Without it the command
stops at `Could not find config defaults`.

```bash
docker run --rm \
  --entrypoint grafana \
  --user "$(id -u):$(id -g)" \
  -v "$PWD/dist:/var/lib/grafana/plugins/my-app" \
  -v "$PWD:/work" -w /work \
  grafana/grafana:<version> \
  cli --homepath /usr/share/grafana --pluginsDir /var/lib/grafana/plugins \
  write-openapi my-app/v1alpha1 -o spec.json
```

That form loads the full server config, so it prints the usual settings and feature-toggle
banner on the way. The spec goes to the file; the noise is on stdout. Do not pipe it into
something that closes the stream early — `| head` will kill the process before it writes.

### Which image has it

`write-openapi` only exists in a Grafana build that contains it, so pin `<version>` to a
release that has shipped the command. To try it before then, build the image from this
repo:

```bash
make build-docker-full          # tags grafana/grafana:dev
docker run --rm --entrypoint grafana --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work grafana/grafana:dev \
  cli write-openapi ./app-sdk-manifest.json -o ./openapi
```

The distroless variant has no shell, which does not matter here — the command is exec'd
directly rather than through one.

## Output

JSON, indented two spaces, with `<` `>` `&` left unescaped so the Kubernetes descriptions
stay readable in a diff. Written to the file or directory `-o` names, or to stdout when a
single version was named and `-o` was not.

Rendering to stdout suppresses the console log so the spec is the only thing on it; the
same messages still go to the log file.

## See also

`pkg/registry/apis/appplugin/pluginopenapi` builds the spec — the command is a thin wrapper
over it. `pkg/registry/apis/appplugin/README.md` explains what the served API looks like and
why.
