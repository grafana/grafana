# Router: core apps served from this process

Status: implemented behind `grafana.routeCoreApps` for collections (Stars) and
preferences, in middleware mode only. The hardcoded parts below are temporary, and the
`preferences/merged` route is blocked on anonymous callers.
Packages: `pkg/router`, `pkg/services/pluginsintegration/pluginroute`, `apps/collections`,
`apps/preferences`

## Context

`collections.grafana.app` and `preferences.grafana.app` were served by builders in the embedded API
server, with a dual writer to the legacy SQL tables. They are meant to move to the router, run as
apps, and later run as a standalone multi-tenant deployment. This note records how they are served
now, what is hardcoded and why, and what has to change in app-sdk so the hardcoding can go.

## How they are served

- With the toggle on (and `grafana.useRouterMiddleware`), the embedded builders stop registering the
  two groups, and the core apps loader (`core_apps.go`, wrapped around the base loader by
  `ProvideRoutesLoader`) adds one backend per app. Startup fails if Grafana cannot sign plugin tokens
  itself or has no local API URL, since nothing else would serve the groups.
- Each app runs in this process behind an in-process v3 client (`v3.NewInProcessClient`): the SDK's
  own authenticated servers over an in-memory connection. The router adds the caller's access token
  as it does for a plugin process, and the app verifies it. So the app is written, and acts, as an
  external one would: it calls Grafana's API through the local token exchange, as the caller, using
  the same local access policy token and exchange URL a plugin process is given (`builtinCoreApps`).
- There is no dual write in this mode. The legacy `/api/user/stars` endpoint no longer reaches this
  storage.
- `collections.grafana.app` and `preferences.grafana.app` are in `routableCoreGroups`. They hold
  per-user data, but access is decided by the router's authorizer, not by the app serving them.

## Authorization by the owner in the name

Objects are named for their owner: `user-<id>`, `team-<uid>`, `namespace`. Access follows the name:

- A user may use `user-<their id>`. They may read a team's object when they are a member, and write
  it when they have the same permission on the team itself. The namespace's object is readable by
  everyone, and writable by an org admin. `allowOrgAdmin` lets an org admin use any name (Stars).
- An access policy is held to the permissions in its own token. Any identity that is not a user
  (an access policy, the image renderer, anonymous) lists only the namespace's preferences. Stars
  have nothing for them.
- A user lists only what they own, most specific first (their own, their teams', the namespace's),
  and may not watch. `ownerScopedStore` does this, and also creates a missing object on update and
  fills in the stored resource version when an update names none, so `kindstore` needs no options.
- A route for a name with no stored object still reaches the app when the kind says so
  (`allowMissingParent`), but only for a not-found. Any other failure to read the parent is the
  storage layer refusing the caller.

All the router knows about Stars and Preferences is in `pluginroute/hardcoded_kinds.go`. It is the
file that gets replaced by what the manifest declares.

## What is temporary

`preferences/merged` is a name no object is stored under. app-sdk rejects a route at that path as
shadowing the resource, so today the router answers `Get` of that name through a getter built from
the app's `Config` (`hardcodedVirtualGetter`, `Options.PreferencesConfig`, `CoreApp.PreferencesConfig`,
`PluginBackend.preferencesConfig`). All of it is marked `TEMPORARY`, and goes away together.

## What app-sdk needs

1. **Fixed names on a kind** (`fixedNames`): lets a version route sit at exactly `{plural}/{name}`
   for a name the kind declares. Then `merged` is an ordinary route the app serves, listing as the
   caller and merging, and the temporary getter above is deleted. Implemented in app-sdk PR 1658
   (branch `kind-fixed-names`).
2. **Authorization by name in the manifest**: owners, fixed names, org-admin access, what other
   identities see, and `allowMissingParent`. The owner naming helpers (`ParseOwnerFromName`) move to
   the SDK with it, which also removes the pinned `pkg/apimachinery` that `apps/*` carry only for
   that helper. Replaces `hardcoded_kinds.go`.
3. **Route documentation**: summaries, descriptions, path parameter details and an operation ID
   override on CUE routes. Today Stars' route carries them through an explicit OpenAPI document
   imported by the manifest (`importOpenAPIFile`, a version property), because the CUE regex only
   allows verb-prefixed operation IDs and `addStar` / `removeStar` cannot be expressed.
4. **Upsert of a missing object**: a storage option next to `listKeys`, so the owner store's create
   on update and its resource version fill-in become generic.

## Blocked: `merged` as a route for anonymous callers

A prototype of item 1 is on the branch `merged-route-fixed-names-prototype`. Everything passes
except the anonymous caller of `preferences/merged`. Such a request reaches the app as identity type
`access-policy`, identifier `anonymous:0`, and the token the app then sends has no permissions of its
own, only delegated ones (`plugins.app:access` and the access kind the manifest declares). The
authorizer treats an access policy as a direct service call and checks its own permissions, as authlib
does (`CheckServicePermissions`), so the app is denied. Declaring the access kind in the manifest does
not change that, and an app-side anonymous check never fires, because the type is never anonymous.

Ways to unblock, in order of preference:

1. Present a delegation on behalf of an anonymous subject as an anonymous requester, not an access
   policy. This is an authentication change, outside the apps.
2. Detect the `anonymous:0` identifier in the app and list as the app itself. It works with the access
   kind, but matches on a string.
3. Keep the hardcoded getter. This is what the code does today.

## Other known differences from the in-process builders

- The router's store is unstructured: a request body with no `kind` is rejected (`Object 'Kind' is
  missing`). The typed builders accepted it.
- Users get a 403 on watch for these kinds.
- Manifests were generated with app-sdk v0.61.0; the output of v0.61.1 is identical.
