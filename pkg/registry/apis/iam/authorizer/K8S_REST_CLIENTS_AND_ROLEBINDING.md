# Kubernetes REST clients and RoleBinding delegation

This note summarizes how RoleBinding write authorization resolves roles for delegation, and how two different `client-go` REST configurations reach the in-process Grafana API server.

## RoleBinding authorization: fetching roles for delegation

On **create** and **update**, `RoleBindingAuthorizer` runs for non–service identities. For each entry in `RoleBinding.Spec.RoleRefs` it:

1. Resolves **effective permissions** for that ref via `RoleRefResolver.GetPermissionsForRef(ctx, kind, name)`.
2. Ensures the caller may delegate every permission via `RolePermissionValidator.ValidateUserCanDelegatePermissions`.

Relevant code:

- `pkg/registry/apis/iam/authorizer/rolebinding_authorizer.go` — `beforeWrite`, loop over `RoleRefs`, resolver + validator.
- `pkg/registry/apis/iam/authorizer/role_permission_validator.go` — `roleRefResolver.GetPermissionsForRef`, `fetchRoleSpec`, delegation checks.

### How roles are fetched (`roleRefResolver`)

The resolver uses a **`ConfigProvider`** that supplies a `*rest.Config`. In the enterprise RoleBinding installer this is **`apiserver.RestConfigProvider.GetRestConfig`** (loopback). It builds a **dynamic client** and **GET**s:

| `RoleBinding` ref kind | API object   | Scope        | Namespace for GET                          |
| ---------------------- | ------------ | ------------ | ------------------------------------------ |
| `Role`                 | `iam` Role   | namespaced   | From `AuthInfoFrom(ctx).GetNamespace()`, or `"default"` if empty |
| `GlobalRole`           | `GlobalRole` | cluster-wide | (no namespace)                             |

Permissions come from unstructured `spec.permissions` (and related fields). For a **namespaced `Role`** that has `spec.roleRefs` (single ref to a `GlobalRole`), the resolver performs **one** extra GET for that global role and merges via `roleeffective.ResolveEffective`.

### Wiring

When the Roles API feature is enabled, the RoleBinding store is wrapped with `NewRoleBindingAuthorizer` and `RoleRefResolverFromConfigProvider(roleConfigProvider)`; `roleConfigProvider` is set to **`restConfig.GetRestConfig`** in:

- `pkg/extensions/apiserver/registry/iam/rolebinding/api_installer.go`

If the Roles API is disabled, `DenyCustomRoleRefsAuthorizer` is used instead.

---

## Two ways to talk to the same apiserver `Handler`

Both paths ultimately invoke **`WrapHandler(s.handler)`**, i.e. they drive the main **`GenericAPIServer.Handler`**, not Kubernetes’ `UnprotectedHandler()`. The important difference is **which identity and `rest.Config` client-go uses**: **loopback** vs **per-request Grafana user**.

### 1. `GetRestConfig` — loopback (used in `role_permission_validator.go`)

**File:** `pkg/registry/apis/iam/authorizer/role_permission_validator.go` (e.g. `dynamic.NewForConfig(cfg)` in `fetchRoleSpec`).

**Source:** `(*apiserver.service).GetRestConfig` returns `s.restConfig`, assigned at startup to **`runningServer.LoopbackClientConfig`**.

**Meaning:**

- Documented as the config for the **loopback transport** (host, bearer token, etc. from secure serving).
- Requests are **not** attributed to the browser/API user via `GetDirectRestConfig`; they use the **internal loopback** client-go identity.

**References:**

- `pkg/services/apiserver/service.go` — `GetRestConfig`, `s.restConfig = runningServer.LoopbackClientConfig`
- `pkg/services/apiserver/restconfig.go` — `RestConfigProvider` comment

### 2. `GetDirectRestConfig` — same signed-in user as the HTTP request (used in `api_adapter.go`)

**File:** `pkg/extensions/accesscontrol/acimpl/api_adapter.go` — `getDynamicClient` uses `GetDirectRestConfig(c)`.

**Source:** `(*apiserver.service).GetDirectRestConfig` builds a `rest.Config` whose `RoundTripper` calls `identity.WithRequester(req.Context(), c.SignedInUser)` and then `grafanaresponsewriter.WrapHandler(s.handler)`.

**Meaning:**

- Intended for **mapping legacy Grafana HTTP handlers to Kubernetes-backed APIs** using the **current request’s `SignedInUser`**.
- Aligns with the `/apis` proxy behavior that sets `identity.WithRequester` from `ReqContext` (see `pkg/services/apiserver/service.go` proxy handler).

**References:**

- `pkg/services/apiserver/restconfig.go` — `DirectRestConfigProvider` comment
- `pkg/services/apiserver/service.go` — `GetDirectRestConfig`
- `pkg/apiserver/endpoints/responsewriter/responsewriter.go` — `WrapHandler` comment (loopback vs Grafana HTTP / `SignedInUser` middleware)

### Summary table

| Aspect              | `GetRestConfig` (loopback)                    | `GetDirectRestConfig`                         |
| ------------------- | --------------------------------------------- | --------------------------------------------- |
| Typical use         | Internal / authorizer role resolution         | Legacy AC HTTP → k8s resources                |
| Example call site   | `role_permission_validator.fetchRoleSpec`     | `acimpl.api_adapter.getDynamicClient`         |
| Requester on wire   | Loopback client-go auth (internal)            | `c.SignedInUser` injected into context        |
| `rest.Config`       | `LoopbackClientConfig` from apiserver startup | Ad-hoc config with custom `Transport` only   |
| Underlying handler  | `s.handler` via loopback transport             | `s.handler` via `WrapHandler` after user bind |

---

## Delegation vs Kubernetes GET authorization

Delegation is enforced in **`ValidateUserCanDelegatePermissions`** (and related helpers) using the **real requester** from the **RoleBinding** request context, not by relying on the loopback GET to be denied if the user lacks RBAC. The loopback client is used to **read role specs** for permission expansion; **whether the user may assign those permissions** is checked separately in the validator.
