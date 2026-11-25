# App settings in the multi tenant router

Status: shared ST/MT handlers and read-only MT storage are implemented on the local branches.
Writes and dual-write migration are follow-up work.

## Goal

Serve app settings, health, resources, and proxy routes through the same implementation in
ST and MT. Deployment supplies the storage, plugin client, and authorization dependencies.
The namespace identifies the tenant. The plugin deployment selects the process; the router
needs no per-tenant plugin-version lookup and supplies no explicit Grafana version to plugins.

## Existing paths

| Path | Settings | Execution |
| --- | --- | --- |
| Enterprise `pkg/apppluginext/builder.go` | Cloudconfig | Existing MT v2 health/resources and proxy, including legacy tenant/version machinery |
| ST router `pluginroute.NewAppSettingsHandler` | SQL adapter, unified storage, or dual writer | Shared v2 health/resources and HTTP proxy |
| MT router settings | Read-only cloudconfig adapter | The same handler as ST, calling the configured plugin deployment |
| MT router manifest groups | Unified storage | v3 routes, admission, and conversion |
| Legacy `/api/plugins/:id/settings` | SQL through `pluginsettings.Service` | Existing legacy writes and cache invalidation |

The public singleton remains
`/apis/<plugin-id>/v0alpha1/namespaces/<namespace>/app/instance`.
Unified storage maps it to group `plugins.grafana.app`, resource `app`, name `<plugin-id>`.
The namespace and secure-value ownership must stay consistent across ST and MT.

## Implementation

### 1. Inject the legacy store — complete

`LegacySettingsStoreProvider` binds a store to a plugin ID. Each operation resolves its
namespace and requester from the request context. ST constructs the existing SQL adapter;
MT supplies enterprise `pkg/routersource/legacysettings`. No changes to `pkg/apppluginext`.

The shared handler receives this store through `PluginBackend.loadSettings`. Provider errors
fail the affected group. An absent provider retains ST's existing unified-only behavior.

### 2. Read MT settings from cloudconfig — complete

The enterprise adapter reuses the authenticated cloudconfig client. It validates the requested
namespace and returned object, preserves enabled/pinned/JSON/metadata, redacts secure values,
and supplies decrypted values through the existing secure-context shim for backend calls.
Missing settings return NotFound. Writes, including dry runs, return MethodNotAllowed.

The router's separate cloud Wire graph receives `CloudSettingsDependencies`: the legacy store and
plugin credential middleware. It constructs no local SQL
services or plugin registry. OSS supplies an empty dependency bundle.

### 3. Use the shared handlers — complete

The plugins source builds the same `PluginBackend` used by ST for each app plugin's settings
group, including apps without v3 manifests. It supplies a pooled v2 client for the deployment's
host. The normal router lifecycle drains handlers before releasing their connections.

There is no `ExternalSubresources` option or composite HTTP fallback. The settings backend owns
settings, health, resources, and proxy. A frontend-only deployment can still serve settings
and declared proxy routes; backend calls report MethodNotImplemented without a v2 host.

Read-only mode selects get/list storage and skips the dual writer. It does not select a
separate subresource implementation. The shared handlers load enabled settings, resolve
secrets, execute the plugin, and apply proxy route authorization as they do in ST. Proxy
registration uses ST's `apppluginsHandleProxyRequests` feature gate.

MT supplies only the context and credentials needed for these requests:

- Namespace, requester, and app instance settings in the plugin context. OrgID remains a
  legacy SDK compatibility field; it does not select a tenant.
- Forward the authenticated requester's OBO token in `X-Access-Token` on health, resource,
  and proxy calls. No ID-token derivation is needed. Existing plugin service-token middleware
  remains separate; the router and enterprise apiserver share its audience policy.
- Remote legacy RBAC for app access and proxy `reqAction` checks. Incoming token scopes and
  namespace restrictions are checked before execution; proxy roles use the shared handler.

No stack-settings lookup, tenant-context middleware, installed-version lookup, or Grafana
version is introduced into the new path. Existing `pkg/apppluginext` remains available for
separate deployments; removing its compatibility machinery is separate work.

### 4. Add writes and dual write — next

Decide between direct SQL-proxy writes and a remote legacy writer. Assess SQL proxy first;
cloudconfig is a cached read interface and cannot provide authoritative write results.

Preserve legacy envelope encryption and key access, secure-field merge/removal, conflicts,
plugin-state events, and cache invalidation. SQL-proxy transactions do not support
`SELECT FOR UPDATE`; an unknown commit outcome requires reconciliation, not blind retries.

Use the same dual-write handler as ST once a writable adapter exists. Add migration policy
for dynamically discovered plugin IDs, resolve `app.*-app` defaults without mutating shared
maps, and register dual-write metrics once. Do not permit configuration to turn the current
read-only adapter into a writer.

### 5. Complete migration

Inventory REST, provisioning, and other legacy writers. Route them through one migration
policy, backfill settings and secrets, reconcile missed secondary writes, and compare state
before switching reads. Move remaining SQL/cloudconfig readers before stopping legacy writes.
A successful primary write alone does not prove the secondary write committed.

## Enablement

```ini
[cloud_router]
plugins_url = https://plugin-manifests.example/plugins
app_settings_enabled = true
cloudconfig_url = https://cloudconfig.example
; cloudconfig_ca_file = /etc/grafana/cloudconfig-ca.pem

[grpc_client_authentication]
token = <service credential>
token_exchange_url = https://auth.example/token
```

Enable the standalone legacy AuthZ client and `authZGRPCServer`. The service credential needs
the cloudconfig audience and the plugin service audiences it will mint. Incoming callers need
scope for the requested app operation, plus legacy app access for delegated identities.
Use `plugins_group_patterns` and namespace visibility to limit rollout. Enable
`apppluginsHandleProxyRequests` to serve the same declared proxy routes as ST.

Disabling MT settings returns group ownership to an existing lower-priority source if one is
configured. Such a source is not required while the shared settings backend is enabled.
Unified-only writes will need a separate rollback plan before they are introduced.

## Validation

Cover settings reads and rejected writes, namespace isolation, secret redaction and backend
secret resolution, disabled settings, token scope and RBAC failures, health/resource gRPC
calls, caller identity, proxy route permissions, discovery, provider failures, and retirement.
Regenerate both Wire graphs and run the enterprise generated-injector test. Existing ST
settings, proxy, and dual-write tests must keep passing. Semgrep remains a landing check when
available in the development environment.
