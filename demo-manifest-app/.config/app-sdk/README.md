# Kinds (grafana-app-sdk)

The [kinds/](../../kinds) directory declares your app's API as [CUE](https://cuelang.org/) "kinds", which
[grafana-app-sdk](https://github.com/grafana/grafana-app-sdk) turns into TypeScript types and an app
manifest.

| File                 | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `manifest.cue`       | The app manifest: app name, and the versions/kinds your app serves.        |
| `example.cue`        | An example kind. Rename it and edit its `spec` to model your own resource. |
| `config.cue`         | Code generation settings (output paths). You rarely need to change this.   |
| `cue.mod/module.cue` | The CUE module definition.                                                 |

## Generating code

After every change under this directory:

```bash
npm run generate:kinds
```

That script always runs the `grafana-app-sdk` version set as `VERSION` at the top of
`.config/app-sdk/generate-kinds.mjs`, reusing a copy in `node_modules/.cache/` or downloading and checksum-verifying one for
your platform. A `grafana-app-sdk` on your `PATH` is ignored, so everyone on the project generates with
the same version. To run a local build instead, set `GRAFANA_APP_SDK_BIN` to its path. It writes:

| Output                  | Path                              |
| ----------------------- | --------------------------------- |
| TypeScript types        | `src/generated/<kind>/<version>/` |
| App manifest (JSON)     | `src/app-sdk-manifest.json`       |
| Go types (backend only) | `pkg/generated/`                  |

Generated code is meant to be committed, so schema changes show up in review and a fresh clone builds
without running code generation.

> **Note:** No Go toolchain is needed to run generate:kinds unless generating Go code.**

## How the manifest reaches Grafana

The generator writes the manifest straight into `src/app-sdk-manifest.json`, so the frontend build's
existing `**/*.json` copy pattern (`.config/bundler/copyFiles.ts`) carries it into the plugin bundle as
`dist/app-sdk-manifest.json` with no dedicated copy step. Grafana reads it when the
`appplugins.loadAppManifest` and `appplugins.registerAPIServer` feature toggles are enabled — the Docker
dev server in this repo enables both for you. Note the toggles are experimental and off by default in
Grafana.

With the manifest in place, Grafana serves storage and CRUD for your kinds through its aggregated API
server, and users can also manage the objects with `kubectl`.

## Adding a backend

Storage and CRUD come from the manifest alone, so a plugin with no backend still gets them. A backend will
be required for:

- Admission logic (i.e. validation/mutation)
- Conversion logic (i.e. between API versions)
- Custom routes and subresource routes
- Controller logic (informers, watchers, or any other background work)

If this plugin has a backend, `pkg/provider/provider.go` is where you wire those up as your app grows.

## Authorization & RBAC

You don't write permission checks in code. You declare roles and scoping in the manifest, and Grafana's
aggregated API server enforces them for every caller (kubectl, Terraform, generated clients, your
frontend). This only applies to requests from users (UI, Service Account tokens) — requests from a
Service Identity (another internal operator) are less strict.

### Folder scoping

Namespaced kinds (set in `kinds/*.cue`, see `example.cue`) are **folder-scoped by default**. Access
requires _both_ the right Stack Role (see below) _and_ folder access on the resource's
`grafana.app/folder`. If your kind's data doesn't belong in folders, opt out with
`folderScoped: false` — access then comes down to the Stack Role alone, and adding a folder annotation
to a request is rejected.

```cue
examplev1alpha1: exampleKind & {
    // Opt this kind out of folder-scoped access.
    folderScoped: false
    schema: {
        spec: {
            title:       string
            description: string
        }
    }
}
```

### Roles and role bindings

Declare custom roles in `kinds/manifest.cue`. A role name follows `<app>:<role>` and grants one of three
tiers — `viewer` (read), `editor` (read + write), or `admin` (currently identical to `editor` — don't
design around admin having extra powers yet). Role bindings attach your app's roles to Grafana's basic
roles (`viewer`, `editor`, `admin`), so every Grafana user inherits the matching app role automatically.
Set `appDisplayName` so your app shows up with a readable name in the Grafana UI's role picker, instead
of the raw `appName`.

```cue
manifest: {
    appName: "demo-manifest-app"
    appDisplayName: "demo-manifest-app"
    versions: {
        "v1alpha1": v1alpha1
    }
    extraPermissions: {
        accessKinds: []
    }
    // roles your app grants, and which Grafana basic role gets each one by default.
    roles: [
        {
            name: "demo-manifest-app:editor"
            permissionSet: "editor"
        },
    ]
    roleBindings: [
        {
            roleName: "demo-manifest-app:editor"
            basicRole: "editor"
        },
    ]
}
```

Without a `roleBindings` entry, a role you define is never granted to anyone — add one for every role you
want users to actually have.
