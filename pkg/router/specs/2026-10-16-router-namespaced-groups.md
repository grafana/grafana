# Router: Namespaced API groups

Status: implemented (proof of concept), 2026-10-16
Package: `pkg/router`

## Context

Some plugins serve one API group per namespace, defined at runtime, such as one group per App
in grafana-gas-app. Each group is a real API group with its own app manifest. The router serves it
natively, because only the router talks to unified storage. Nothing here is specific to any one
plugin: the feature is *namespaced API groups*.

## Group layout

`<name>.<namespace>.<owner group>`, for example `myapp.stacks-123.gas.ext.grafana.app`. The
namespace is the single label before the owner group, and must be a DNS label. Namespaces contain no
dots, so the parse is never ambiguous (`parseNamespacedGroup`). The group still ends in
`.ext.grafana.app`, so the rules keyed on that suffix still apply.

## Config

`[cloud_router] namespaced_groups` lists the owner groups (`*.ext.grafana.app`). With the cloud
loader, owners come from `plugins_url` or `core_url`, and one of them is required. The local plugin
loader reads it too (`namespacedLoader`). No owner may be one of another owner's namespaced groups.

## Source (`plugin_manifests_namespaced.go`)

- The source polls the owner plugin's cluster-scoped `_manifests` route over v3 `CallRoute`, at a
  served version that declares it (the preferred one if it does; `namespacedManifestsVersion`), as
  the router's own service identity, and follows `continue` until it is empty. It uses the
  `backendPoller` loop and cooldown of the other plugin sources.
- Each manifest becomes a plugin backend of the owner plugin, with the owner's clients. Its key
  covers the manifest and the owner's key, so the existing reconcile rebuilds only the groups that
  changed. Its source is `namespaced:<owner group>`, and its key `namespaced:<pluginId>:<hash>`.
- A manifest with a malformed group, or one that fails validation, is skipped, logged and counted.
- Nothing is served while the owner isn't loaded.
- In the cloud loader, namespaced groups override only the ST fallback, so a namespace's group never
  shadows a group another source serves.
- Only the owner's namespaced source serves a group ending in `.<owner group>`
  (`namespacedOwnerOf`). `plugins_url` and `core_url` skip, log and count any other plugin's, and
  `namespacedLoader` drops the local plugin loader's with a warning. So no plugin can claim a
  namespace's group, shadow it, or have its kinds reached by the owner's service permissions,
  which unified storage and the plugin route authorizer extend to any group of the form
  `<name>.<namespace>.<owner>` that names the request's namespace
  (`namespacedgroups.CheckServicePermissions`), since they can't tell which plugin serves a group.
  They rely on the router for this, and the router is the only server of plugin groups.
- Each backend implements `NamespacedBackend` (`types.go`): `Namespace()` and `OwnerGroup()`. The
  engine knows only this interface, never the group layout.

## RBAC

Each namespaced group has its own roles, with its own actions (`<group>/<resource>:<verb>`), so
the authz service checks it with the K8s-native fallback, as any plugin group. The roles are those
`manifestRoleRegistrations` makes from the group's manifest, as for a local plugin: the manifest's
own roles and bindings, plus a reader and a writer granted to viewers and editors for every kind
no declared role names (a role for a custom route, `Kind/<route>`, doesn't count). A tenant
manifest declares no roles, so it gets just the reader and writer. Folder permissions still decide
which objects a holder reaches.

The defaults are local only. pluginmanifests (`BuildRoleRegistrations` and the GlobalRole
reconciler in grafana-enterprise) registers exactly the declared roles, so in Cloud a manifest that
adds a route role, such as gas-app's `exposer`, gets that role and nothing else; kinds that need
roles there must declare them. pluginmanifests also requires `<app>:<role>` names, a title, and a
`permissionSet` (not `verbs`) on each role kind, and maps both the editor and admin sets to get,
create, update and delete.

- **Local (middleware mode).** The namespaced source declares the roles at runtime through
  `ReplaceFixedRoles` (`pkg/services/accesscontrol/acimpl`), which the router type-asserts on the
  access control service. After the first successful poll, and each one whose key set changed, it
  passes the roles of every manifest it serves, owned by `namespaced:<owner group>`. That is the
  owner's whole desired set: roles left out are removed, changed ones updated, new ones added, as
  pluginmanifests reconciles a plugin's roles in Cloud. A failed poll, or one without the owner,
  declares nothing, so an error never removes roles; a successful poll with no groups removes them
  all. A failed declaration is retried on the next poll. Called before startup registers the fixed
  roles, it only records them, and registration applies them.
- **Cloud (planned).** The router declares no roles. pluginmanifests is to read the owner's
  `_manifests` route and reconcile the groups' roles as IAM GlobalRoles, as it does for the
  plugins' own manifests. GlobalRoles are cluster-wide, so their number grows with the namespaces'
  groups.

## Visibility, dispatch and the guard

A namespaced group is visible only to callers in its namespace, and to callers with the wildcard
namespace `*`, as `authlib.NamespaceMatches` decides (`servingEntry.visibleTo`). A caller without a
namespace sees none.

`*` callers are service identities that act across namespaces, such as plugin operators.
`NamespaceMatches` lets them use any namespace's resources, so they can use every namespaced group
whose namespace the request path names, and read its group and version discovery, OpenAPI document
and manifest. But the documents that list every group (root discovery, the `/apis/discovery`
manifest list and index, and the status page) list a namespaced group only to callers in its
namespace (`servingEntry.listedFor`), never to `*` callers: listing every namespace's groups would
grow with the number of namespaces, and fetch each one's discovery.

- **Dispatch:** `HandleFunc` and `serveOpenAPIGroupVersion` treat a group the caller can't see as
  unknown, before the OpenAPI cache. The answer is exactly the one for a group the router doesn't
  serve (`next`, or the ST fallback), so nothing reveals that the group exists.
- **The guard** (`namespaceGuard`) wraps each backend's handler. It repeats the caller check, so the
  handler is safe however it is reached, such as by the router's own discovery fetches. It also
  requires a namespaced path to name the group's namespace. Of the paths without a namespace, it
  serves only root, group and version discovery and the version's OpenAPI document; anything else
  is a 404. Empty segments are refused rather than trimmed, so the path it checks is the path the
  handler serves; only `/apis/<group>/` is allowed, as for any other group. Without the guard, a caller could write to another namespace's group inside its own
  namespace, and run that group's hooks.

## Discovery

- `publish` leaves namespaced groups out of the published `/apis` and `/openapi/v3` documents, and
  out of the `/apis/discovery` manifest list and index. It records how many namespaced groups each
  namespace has (`namespacedGroups`), so a request can tell cheaply whether any are listed to it.
- A caller with none listed to it, `*` included, gets the published documents. A caller with some
  gets documents built per request, with its groups merged in. Groups owned by the router but not
  listed to the caller are also dropped from the documents `next` or the ST fallback supplies.
- Aggregated discovery skips unlisted groups before starting any fetch. The shared discovery cache is
  keyed by group, and a group's discovery doesn't depend on the caller, so callers in a group's
  namespace may share its entry. It is only read and filled by them, and filled with their
  credentials.
- A namespaced group's manifest (`/apis/discovery/v1alpha2/manifests/<group>`) is a 404 for other
  namespaces, and the status page leaves out its group and shadowed entries for every caller it
  isn't listed to. A shadowed entry carries the namespace of a namespaced backend on either side
  (`shadowedGroup.Namespace`), so it stays hidden where a real group serves the name.
- While any namespaced group is served, root discovery and the `/apis/discovery` tree are sent with
  `Cache-Control: private`, so a shared cache can't give one namespace's documents to another.
- A namespaced group's OpenAPI document is marked `private` by the guard, so the router's OpenAPI
  cache never stores it.

## Metrics

Namespaced groups come and go at runtime, so their names would leave the `group` label unbounded.
Every metric with a `group` label uses the owner group for them (`backendMetricGroup`, recorded per
entry in `publish`): request metrics, backend failures, breaker transitions and discovery results.
`grafana_router_breaker_state` counts the groups under each label in each state, so the owner's value
is the number of its groups in each state. For other groups it stays 1 or 0. Logs and traces keep
the full group.

Each namespaced group's in-process API server labels the metrics it records itself by the owner
too (`pluginroute.Options.MetricGroup`, set from `PluginBackend.metricGroup`):

- The manifest's custom routes are recorded in `apiserver_request_total` and its siblings under the
  owner group and the resource `routes`, since their paths are defined at runtime too.
- The built-in routes (search, keys) use the owner group and their fixed paths
  (`builder.APIGroupMetricGroupProvider`).
- The watch establishment histogram, labelled by group, isn't registered.

The generic API server's own request and watch metrics for the kinds stay unbounded: one set of
series per namespaced group and kind. They are registered globally (`legacyregistry`) and labelled
with the group the handler installs, so they can't be relabelled per handler. They are
`apiserver_request_total`, `apiserver_request_duration_seconds`,
`apiserver_request_sli_duration_seconds`, `apiserver_response_sizes`,
`apiserver_longrunning_requests`, `apiserver_request_aborts_total`,
`apiserver_request_terminations_total`, `apiserver_selfrequest_total`,
`apiserver_watch_events_total`, `apiserver_watch_events_sizes` and
`apiserver_watch_list_duration_seconds` (exported with the `grafana_` prefix).

## Limitations

- **Scale.** The source holds every namespace's manifests, and the router builds a handler for every
  group up front. Each change compares every key and republishes the snapshot.
- **Per-request documents** iterate the whole snapshot.
- **`*` callers can't discover namespaced groups.** They must already know a group's name, and the
  namespace, to use it.
- **No OpenAPI caching** for namespaced groups, and the index is rendered per request for callers they
  are listed to.
- **Owner label.** The owner group's own metrics and its namespaced groups' share one label.
- **Unbounded apiserver metrics.** The generic API server's request and watch metrics for the
  namespaced groups' kinds are labelled by group (see Metrics).
- **Role count.** Every group's roles are held in memory and in the database (in Cloud, as
  GlobalRoles), and each change rebuilds the basic roles from every registration.
- **Service tokens can't name namespaced groups.** Unified storage and the plugin route authorizer
  stand in: for service permissions only, they grant a namespaced group of the request's namespace
  through a permission for its owner's whole group. Other verifiers of authlib's matcher don't,
  until authlib carries the rule; see `2026-10-16-namespaced-groups-identity.md`.
- **Propagation** waits for the next poll; there are no ETags or change feed yet.

## Open questions

### One role for every namespaced group, or roles per group?

A namespaced group's kinds need actions that some role grants. Unified storage always enforces
RBAC for `*.ext.grafana.app`, and the authz service matches actions exactly, so a group created
at runtime has no role until one is made for it. Folder permissions apply either way: the check
is the stack role AND the object's folder.

- **A single role for all of an owner's namespaced groups.** The authz service checks a namespaced
  group's resources, in the namespace the group names, against one action named after the owner
  (e.g. `<owner>/namespacedgroups:<verb>`), which one fixed role per owner grants to the basic
  roles.
  - For: no roles per group, so nothing to create, sync or remove at runtime; a new group is
    usable as soon as it is served; constant role count; works the same locally and in Cloud.
  - Against: an authz change, a fallback rule in `validateAction` keyed on the group's layout,
    that the authz owners would have to accept; the action is synthetic, not one the group's
    manifest declares; every group of an owner shares one role, so access comes down to basic
    role plus folder, with no roles per App; Cloud still needs pluginmanifests (or the manifest)
    to create the owner's role, whose action names no kind.
- **Roles per group** (what this branch does locally). Each group's manifest yields its own
  roles, with the K8s-native actions (`<group>/<resource>:<verb>`), declared at runtime.
  - For: no authz change; standard actions that the manifest describes; a group can have roles of
    its own, granted like any other role.
  - Against: roles are created, changed and removed at runtime, with a delay before a new group
    is usable; the role count grows with the groups. In Cloud this needs thought: GlobalRoles are
    cluster-wide, so every tenant's group roles would exist, and possibly be listed, in every
    stack. The roles should be per namespace instead. Fixed roles are written to the declaring
    instance's own database, so each stack's Grafana declaring only its own namespace's groups
    (a reconciler outside the router, with `_manifests` filtered by namespace) would keep them
    private to the tenant, but the multi-tenant router owns no stack's database, and IAM's
    namespaced `Role`s can't bind to basic roles.
