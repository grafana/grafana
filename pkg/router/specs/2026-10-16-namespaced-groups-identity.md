# Router: Identity and token permissions for namespaced groups

Status: storage half implemented in Grafana (see "Grafana-side rule"); the authlib proposal is
optional
Package: `pkg/router`, `pkg/storage/unified/resource`, optionally `github.com/grafana/authlib`

A namespaced group (`<name>.<namespace>.<owner>`, see `namespaced_groups` in `AGENTS.md`) is
created at runtime. Users reach one through its own roles, which the router declares at runtime
from its manifest (see RBAC in `2026-10-16-router-namespaced-groups.md`). Service tokens are the
other half: their permissions are issued in advance, so they can't name these groups.

## The problem

Token permissions are matched by authlib's `groupMatches` (`authz/service_permissions.go`). A
wildcard group must be one of `allowedWildcardGroups` (`*.datasource.grafana.app`,
`*.ext.grafana.app`, `*-app`), and the part it matches must be a single label. So
`myapp.stacks-1.gas.ext.grafana.app` matches no wildcard, and on that matcher alone no token
reaches a namespaced group:

- **Session users.** `AccessClaimsHook` gives every user calling Grafana directly the delegated
  permissions `*.ext.grafana.app:*` (among others), so storage's tokenless exemption doesn't apply:
  every write to a namespaced group failed with "this service's token has no delegated permission".
- **The owner plugin's own tokens** and the delegated permissions in its tokens on behalf of a
  user. Token exchange grants the plugin exactly `<group>:*` (`pluginauth/tokenexchange/service.go`,
  `policyFor`). The plugin can't call its namespaced groups' storage, which Functions need
  (Workstream B4).
- **Grafana's service identity** (`apimachinery/identity/context.go`,
  `serviceIdentityTokenPermissions`): `*.ext.grafana.app:*` doesn't reach them. It already lists
  `assistant.alertrules.ext.grafana.app:*` by name for the same reason.
- **Access policies** issued by the cloud (CAP), which go through the same matcher.

The matcher is applied to namespaced groups in two places:

- **Unified storage**: `checkServiceTokenPermissions` and `authzLimitedClient`
  (`pkg/storage/unified/resource/access.go`), and again inside authlib's `authz.ClientImpl`, which
  re-checks service permissions before asking the authz service about the user.
- **The plugin route authorizer** (`pkg/services/pluginsintegration/pluginroute/authorizer.go`,
  `authorizeTokenPermissions`), which the router's plugin backends use for every manifest they
  serve, a namespaced group's included, and which decides for an access policy itself.

The API server's service authorizer (`pkg/services/apiserver/auth/authorizer/service.go`) guards
only dashboards, folders and IAM, so it never sees a namespaced group.

## Grafana-side rule (implemented)

For service permissions only, storage and the plugin route authorizer treat a namespaced group of
the request's namespace as its owner group (`namespacedgroups.CheckServicePermissions`):

- The group must be `<name>.<namespace>.<label>.ext.grafana.app` with `<namespace>` equal to the
  request's namespace (`namespacedgroups.Owner`). An
  empty or `*` namespace, or a group naming another namespace, keeps its own permissions.
- The token needs a permission for the owner's whole group with the verb: `<owner>:*`,
  `<owner>:<verb>`, or a wildcard that matches the owner, such as `*.ext.grafana.app:*`. A
  permission for one of the owner's resources (`<owner>/<resource>:...`) does not count, since
  the owner's resources aren't the namespaced group's. A permission naming the namespaced group
  exactly still matches on its own.
- The authz service still sees the namespaced group itself, so RBAC decides by the group's own
  roles. Because authlib's `ClientImpl` re-checks the real group,
  storage passes it an identity whose token additionally holds `<group>/<resource>:<verb>` (in its
  permissions for an access policy, its delegated permissions otherwise), only for checks it has
  already granted through the owner (`access_namespaced.go`).

This covers every token above with no change to authlib, token exchange, the service identity or
CAP policies: the owner plugin's `<owner>:*`, Grafana's `*.ext.grafana.app:*`, and users' delegated
`*.ext.grafana.app:*` all reach the owner's namespaced groups in their own namespace.

The proposal below is no longer needed for the namespaced groups MVP. It remains the long-term
option if another consumer of authlib's matcher (another service, or a token that should reach only
some owners' namespaced groups) needs the same rule, so that every verifier agrees without a
Grafana-side wrapper; moving the rule above into authlib (`CheckServicePermissions` with the
request's namespace) would be the smaller change.

## Proposal (optional): an opt-in multi-label wildcard

Add a second wildcard form to authlib, `**.<owner>`, which matches any group with one or more labels
before `<owner>`:

- `groupMatches`: a permission group starting with `**.` matches when the request group ends in
  `.<owner>` and has a non-empty prefix. Unlike `*`, the prefix may contain dots.
- It is allowed only for owners of the form `<label>.ext.grafana.app` (a plugin group), never for
  `ext.grafana.app` itself, `datasource.grafana.app` or a core group. So `**.ext.grafana.app` and
  `**.grafana.app` stay invalid. Keep the allowlist closed: either a rule
  (`IsAllowedMultiLabelWildcardGroup`) or, more conservatively, an explicit list fed by
  configuration.
- `IsAllowedWildcardGroup` (used by grafana-auth and auth-signer to validate the permissions they
  sign) must accept the new form under the same rule, or signing will reject it.

It doesn't need to know about namespaces: the owner plugin owns every group under its own group,
and the router only serves the ones its `_manifests` route lists. The token's namespace claim
still limits it to one namespace, and the router's `namespaceGuard` serves a group only in the
namespace it names.

### Uses once authlib supports it

1. **Token exchange** (`policyFor`): for a plugin group, also grant `**.<group>:*`, and delegate it
   like the plugin's own group. There's a TODO there. Grant it only to plugins that serve namespaced
   groups (a served version declares the cluster `_manifests` route, as `namespacedManifestsVersion`
   decides), so that other plugins' tokens don't change.
2. **Grafana's service identity** (`serviceIdentityTokenPermissions`): add `**.<owner>:*` for each
   configured `namespaced_groups` owner, or a general rule for plugin groups if authlib allows one.
   Today the list is static, so this needs the owners passed in or a broader pattern.
3. **Cloud access policies (CAP)**: the owner plugin's policy (and the router's, if it ever reads
   them) needs `**.<owner>:*`. The CAP API validates permission strings, so it needs the same
   rule.
4. **auth-signer / grafana-auth**: they validate requested permissions with
   `IsAllowedWildcardGroup`. Update and release them with the new authlib before any policy names
   the new form, or the exchange fails.

### Rollout

authlib first (matcher and validation, with tests showing that `**.gas.ext.grafana.app` matches
`a.stacks-1.gas.ext.grafana.app` and `a.b.stacks-1.gas.ext.grafana.app` but not
`gas.ext.grafana.app` or `x.other.ext.grafana.app`). Then auth-signer and grafana-auth, then the
CAP policies, then Grafana (`go.mod` bump, `policyFor`, the service identity). Until everything
accepts the form, nothing may issue it: a verifier on the old matcher simply wouldn't match it, but
a signer on the old validation would reject the whole policy.

## Not covered

- **Zanzana** maps resources to its own model. Deployments that check through Zanzana
  (`zanzanaNoLegacy`) haven't been tried with the groups' runtime roles.
- **Cloud roles**: the router declares the groups' roles only in middleware mode. In Cloud they
  wait for pluginmanifests to reconcile them as GlobalRoles from the `_manifests` route, so until
  then no user reaches a namespaced group there.
