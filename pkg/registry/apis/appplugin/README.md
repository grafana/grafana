# Manifest-defined APIs for app plugins

This package registers locally installed app plugins as Grafana API groups. In
addition to the existing `Settings` resource, an app plugin can use its
`app-sdk-manifest.json` to declare versions, kinds, schemas, custom routes,
admission hooks, and roles.

This support is experimental. The manifest format and the plugin v3 protocol
can still change.

## Enable manifest APIs

Both feature toggles are required:

```ini
[feature_toggles]
appplugins.loadAppManifest = true
appplugins.registerAPIServer = true
```

`appplugins.loadAppManifest` loads the manifest into the plugin definition.
`appplugins.registerAPIServer` registers one API group for each local app
plugin. A plugin without a manifest continues to serve only its settings API.

## Registered resources

The API group is the manifest's `group`, falling back to the plugin ID when the
manifest does not declare one. Only versions marked `served` are registered,
with `preferredVersion` first in discovery. The existing `v0alpha1` settings
API remains available even when the manifest does not declare that version.

Each manifest kind is stored as an unstructured resource in unified storage.
The registration honors:

- namespaced or cluster scope;
- folder scoping for namespaced resources (enabled by default);
- OpenAPI schema validation, pruning, and defaults;
- a `/status` subresource when the schema declares `status`;
- additional printer columns and server-side apply managed fields;
- `/search` and `/trash` routes for eligible kinds; and
- manifest-declared version routes and kind subresource routes, forwarded to
  the plugin's v3 route service.

The generated OpenAPI document replaces the generic unstructured request and
response bodies with the schemas from the manifest. It is available at:

```text
/openapi/v3/apis/<group>/<version>
```

For the SDK test plugin, the Swagger UI is:

```text
http://localhost:3000/swagger?api=grafana-app-sdk-test-app-v1alpha1#/
```

This change does not add the standalone `grafana cli write-openapi` command or
the plugin router from the larger proof-of-concept branch.

Manifests are read from local plugins during startup; this package does not
watch for manifest changes. The manifest's custom conversion capability is not
dispatched by this implementation.

## Authorization

Requests must first pass the app plugin access check. Manifest roles are then
registered as fixed Grafana roles for the kinds they name. When a manifest has
no roles, default reader and writer roles are bound to the Viewer and Editor
basic roles. Folder permissions still determine access to individual
folder-scoped objects.

Cluster-scoped kinds are reserved for service identities unless the manifest
marks them `userReadable`. End users can only `get` or `list` a user-readable
cluster-scoped kind.

## Admission hooks

A kind can declare mutation and validation operations in its `admission`
block. The plugin v3 protocol returns both the mutated object and the admission
decision from one `AdmissionReview` call, so an operation that declares both is
called once during the mutating phase. Validation-only operations are called
during the validating phase.

`CREATE`, `UPDATE`, `DELETE`, and `*` are supported. `CONNECT` and subresource
writes are not sent to admission because the v3 request cannot represent the
subresource. Plugin errors fail the request closed, warnings are returned to
the client, and a mutation cannot change the object's identity or managed
fields.

Schema validation runs after mutation. A mutation that produces an object that
does not match the manifest schema is rejected before it is stored.
