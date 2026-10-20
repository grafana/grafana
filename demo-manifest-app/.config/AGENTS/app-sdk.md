---
name: grafana-app-sdk kind instructions for a grafana plugin
description: Guides how to work with CUE kinds and generated code in a plugin that uses the grafana-app-sdk
---

# grafana-app-sdk kinds

This plugin defines its own API resources ("kinds") as [CUE](https://cuelang.org/) schemas using the
[grafana-app-sdk](https://github.com/grafana/grafana-app-sdk). Code generation turns those schemas into
TypeScript types and an app manifest that Grafana reads from the plugin bundle.

## Critical rules

- **`kinds/*.cue` is the source of truth for the API.** To change a resource's shape, edit the CUE and
  regenerate. Never work the other way around.
- **Never hand-edit generated code.** Everything under the generated directories listed below is
  overwritten on the next run, so edits there are silently lost. They carry a
  `Code generated - EDITING IS FUTILE. DO NOT EDIT.` header.
- **Regenerate after every change under `kinds/`:**
  ```bash
  npm run generate:kinds
  ```
- **Generated code is committed.** Commit the regenerated files alongside the CUE change so schema
  changes are reviewable and a fresh clone builds without running code generation.
- **Go code generation follows `kinds/config.cue`'s `codegen.goEnabled` setting.** If it's `false`,
  generation emits only TypeScript and the JSON definitions — don't add Go output paths or a Go
  backend to work around a generation problem.
- **Do not set `GRAFANA_APP_SDK_BIN`.** It overrides the pinned CLI with a local build, and is meant
  for people working on the app-sdk itself. Code generated with it can differ from what `VERSION` in
  `.config/app-sdk/generate-kinds.mjs` produces, so committing it would put the repository out of step. Run
  `generate:kinds` without it.
- **Do not add code generation to the build.** It is a schema-change-time step, not a build step. The
  frontend build must keep working without a Go toolchain.
- **Never write authorization/permission checks in app code.** Access is declared in the manifest and
  enforced by Grafana's API server, not by this plugin.
- **A `Namespaced` kind is folder-scoped by default:** callers need the Stack Role _and_ folder access,
  and every write must set the `grafana.app/folder` annotation to a real folder the caller can access —
  this applies to anything your backend writes on a user's behalf too. Set `folderScoped: false` on the
  kind if it shouldn't be gated by folders (writes then skip the annotation).
- **Every role needs a `roleBindings` entry to be granted to anyone.** Defining a role in
  `kinds/manifest.cue` without binding it to a basic role (`viewer`/`editor`/`admin`) leaves it unused.
- **Set `appDisplayName` in `kinds/manifest.cue`** so the app's roles show a readable name in Grafana's
  role picker, instead of the raw `appName`.
- **`admin` currently grants the same actions as `editor`.** Don't design a feature assuming admin has
  extra permissions today.

## Layout

| Path                        | What it is                                                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `kinds/manifest.cue`        | The app manifest: app name, and the versions and kinds your app serves.                                                          |
| `kinds/*.cue`               | One file per kind. Edit these to change a resource's schema.                                                                     |
| `kinds/config.cue`          | Code generation settings (output paths). Rarely needs changing.                                                                  |
| `src/generated/`            | Generated TypeScript types. **Do not edit.** Import from here in frontend code.                                                  |
| `src/app-sdk-manifest.json` | Generated app manifest JSON. **Do not edit.** The frontend build's existing JSON copy pattern carries it into the plugin bundle. |

## Changing a schema

1. Edit the relevant kind in `kinds/`. Add a new kind by creating a file and listing it in the version's
   `kinds` array in `kinds/manifest.cue`.
2. Run `npm run generate:kinds`.
3. Update the frontend to match. Because the TypeScript types are generated from the CUE, a schema
   change surfaces as a type error wherever the code is now wrong — fix those rather than casting.
4. Commit the CUE and the regenerated files together.

Common CUE constructs, for reference:

```cue
spec: {
    title:       string                          // required
    owner?:      string                          // optional
    tier:        *"gold" | "silver" | "bronze"   // enum, defaults to "gold"
    labels: [string]: string                     // map
    tags: [...string]                            // list
}
```

For anything beyond this — subtypes, time types, constraints, multiple versions — consult the app-sdk's
kind authoring reference at
https://github.com/grafana/grafana-app-sdk/blob/main/docs/custom-kinds/writing-kinds.md rather than
guessing at CUE syntax.

## Serving the kinds

Grafana serves storage and CRUD for the kinds from the manifest bundled in the plugin, behind the
`appplugins.loadAppManifest` and `appplugins.registerAPIServer` feature toggles. The development server
enables both. Grafana only reads plugin manifests at startup, so restart it after rebuilding.

Resources are served under a Kubernetes-style path:

```
/apis/<group>/<version>/namespaces/<namespace>/<plural>
```

The namespace is deployment-dependent — `default` on single-tenant Grafana, `stacks-<id>` on Grafana
Cloud. Read it from `config.namespace` in `@grafana/runtime`; never hardcode it.

No backend is needed for storage or CRUD — that comes from the manifest alone. Admission (validation
and mutation), conversion between versions, and custom routes require a backend.
