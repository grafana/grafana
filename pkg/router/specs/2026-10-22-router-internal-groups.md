# Router: Internal API groups

Status: implemented
Package: `pkg/router`

## Context

Some groups that aggregate targets serve are meant only for other services, for example `mobile.ext.grafana.app` on `baas_apiserver`. Its operators call it as themselves, or on behalf of a user (OBO), and the backend authorizes that user with the token's delegated permissions. 
End users must not reach it, and must not learn that it exists: to them it must look exactly like a group nobody serves.

The router already treats a group it does not serve in one well-defined way: the request goes to the single-tenant fallback or to `next`, and no discovery document lists the group. An internal group reuses that path for every caller that isn't allowed to see it.

## Who signs the token a request carries

The decision depends on which identity signed the caller's access token, so it matters who that is. 
This was checked against `hosted-grafana` (`pkg/gateway/mtauthnauthenticator.go`),`grafana-enterprise` (`pkg/authn/authenticator.go`, `ext_jwt.go`, `identity.go`) and `AccessPolicyToken` resources.

1. The HG gateway authenticates the end user's session by calling `grafana-authn-service` (`AuthnService/Authenticate`) with its own token, `hosted-grafana-gateway-authn-service-token`, whose audience is `authnService`. That token never reaches Grafana or the router.
2. The authn service signs an access token through auth-api with its own access policy (`AccessPolicyToken-grafana-authn-service.yaml`): `serviceIdentity: grafana-authn-service`, delegated permissions `set:hosted-grafana-delegated-permissions`. For an end user, the token acts on behalf of `user:<id>`.
3. The gateway strips the inbound credentials and forwards `X-Access-Token` (and `Authorization`) with that token.

So the tokens the router sees are:

| Caller | `serviceIdentity` (outermost signer) | Actor |
| --- | --- | --- |
| End user, through the gateway | `grafana-authn-service` | `user:<id>` |
| Operator, in-cluster | the operator's own, such as `mobile-operator` | none, or `user:<id>` for OBO |
| Operator, through the gateway | `grafana-authn-service` | the operator, and its user if any |

A service that calls through the gateway is re-signed (`ext_jwt.go`, `exchangeAccessPolicyAccessToken`): the outer `serviceIdentity` becomes `grafana-authn-service`, and the caller's own identity moves into `act`. authlib exposes it as `GetExtra()["innermostServiceIdentity"]`.

### Why the identity type can't decide

`GetIdentityType()` is `user` both for an end user and for an operator acting on behalf of one, since an OBO token reports its actor. Only the signer tells them apart.

## The policy

A caller is **internal** when:

- it is Grafana itself (`identity.IsServiceIdentity`), for a request that was not authenticated by an access token; or
- it was authenticated by an access token (`login.ExtendedJWTModule`), and the token's signer is in `[cloud_router] internal_identities`. The signer is the token's outermost `serviceIdentity` (`GetExtra()[authnlib.ServiceIdentityKey]`), or its `access-policy:<id>` subject (`GetAuthID()`) for an access policy without `accessTokenMetadata`. The subject keeps its prefix, so it can never match a service identity.

Every other caller is **external**: tokens signed by `grafana-authn-service` (every end user, and any service that went through the gateway), session-cookie and anonymous users in middleware mode, and every service that isn't listed. 
Both modes build the same requester fields (`AuthenticatedBy`, `AuthID`, the `serviceIdentity` extra), so the policy is the same in both.

| Caller, with `internal_identities = mobile-operator` | Result |
| --- | --- |
| `serviceIdentity: grafana-authn-service`, acting for `user:123` (a browser) | hidden |
| `serviceIdentity: mobile-operator` | served |
| `serviceIdentity: mobile-operator`, acting for `user:123` | served; the backend authorizes `user:123` |
| `serviceIdentity: grafana-authn-service`, innermost `mobile-operator` (operator via gateway) | hidden |
| `serviceIdentity: some-other-service` | hidden |
| Grafana forwarding a gateway request (`rewriteOutbound` keeps the original token) | hidden |
| Any caller, with `internal_identities` unset | hidden |

### An allowlist, not a denylist

An allowlist fails closed. An empty list hides internal groups from everyone but Grafana itself, and the cloud loader warns at startup when `internal_groups` is set without it. Adding an operator is a
router config change, which is acceptable while few services call internal groups and their owners are known.

### One list for every internal group

Ideally each internal group would list the services allowed to call it, so that `mobile-operator` could not see another team's internal group. For now `internal_identities` is one list for every internal group, for simplicity: there is one internal group, and its callers are known. When a second internal group with different owners appears, move the list per group (under
`[router.aggregate.<name>]`, or keyed by group). The engine's hook does not need to change for that: only the service's policy does.

### Operators call in-cluster

Since re-signing hides the original caller in `act`, an operator that calls through the gateway is treated as the gateway's caller and gets the hidden view. 
Operators must call the router in-cluster with their own token. Trusting `innermostServiceIdentity` instead would let anyone who can make the gateway sign a token on a listed service's behalf reach internal groups, so the policy reads only the outermost signer.

## Engine and source

The split follows AGENTS.md: the engine never knows what makes a caller internal.

- **Engine** (`types.go`, `router.go`, `discovery*.go`): an optional `RestrictedGroup` Backend
  interface, and `GrafanaRouter.internalCaller`, a predicate the service sets. For a caller that
  isn't internal, a restricted group goes to `serveUnregisteredGroup` (with route `hidden`) and is
  left out of `/apis` in both formats, `/openapi/v3`, the manifests, `AGENTS` and the status page.
  The root documents and manifests are published in full and without restricted groups, and
  per-request documents filter as they are built. A response that depended on the caller is sent
  with `Cache-Control: private`.
- **Source** (`aggregate_*.go`, `cloud_router.go`, `service.go`): `internal_groups` on an aggregate
  target marks the backends of the groups it names; their key gets an `:internal` suffix, so a group turning
  internal or public republishes discovery, and their proxied responses are made private, so a
  shared cache can't replay one to an external caller. `newInternalCallerPolicy` reads
  `internal_identities`, and `ProvideService` sets it in every mode.

`RestrictedGroup` returns a bool, unlike the `CallerScopedDiscovery` marker. A wrapping backend such
as `singleTenantResourcesBackend` embeds the `Backend` interface, which does not promote the methods
of optional interfaces. A marker can't be forwarded: a wrapper would either always claim it or never
do so. With a bool, the wrapper always implements the method and returns the wrapped backend's
answer. A wrapper that forgets would make its group public.

`internal_groups` lists exact group names, not globs like `group_regex`. There is one internal
group, and a pattern brings traps an exact name doesn't: a stray `*` would hide every group on the
target, and an empty list must match no group, the opposite of `group_regex`. Adding globs later is
compatible, since an exact name is also a valid glob.

## Follow-ups

- A per-group allowlist, once internal groups have different owners.
- Globs in `internal_groups`, once a family of internal groups shares a naming scheme. A new group
  matching one would then be hidden as soon as it is discovered, without a config change.
- Manifest-declared visibility: once an app manifest (or aggregated discovery) can mark a group internal, plugin backends can implement `RestrictedGroup` from it with no engine change. `pluginDeploymentBackend` would then need to forward it.
