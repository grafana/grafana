# App settings in the multi tenant router

Status: steps 1–4 implemented across OSS and the enterprise companion.
MT settings reads are opt-in; writes and dual-write migration remain planned.
Package: `pkg/router`, with MT adapters in `grafana-enterprise`.

Host app plugin settings in the MT router using the same settings handler and dual-write
policy as single-tenant Grafana. Start with read-only settings from cloudconfig, decide the
write path separately, and retain the existing enterprise execution path until health,
resources, and proxy behavior can move without losing tenant isolation, credentials, or plugin version selection.

## Existing paths

| Path | Settings | Execution |
| --- | --- | --- |
| Enterprise `pkg/apppluginext/builder.go` | Read-only `Settings` from cloudconfig, which reads the tenant's SQL `plugin_setting` table | v2 health and resources, HTTP proxy, optional per-tenant processes and installed versions |
| Local router `pluginroute.NewAppSettingsHandler` | Legacy SQL adapter, unified storage, or the configured dual writer | v2 health and resources and HTTP proxy |
| MT router manifest handler | Manifest kinds in unified storage | v3 routes, admission, and conversion |
| Legacy `/api/plugins/:id/settings` | Writes directly through `pluginsettings.Service` to SQL | Cache invalidation and legacy settings behavior |

Settings are separate from manifest kinds. Keep the public singleton at
`/apis/<plugin-id>/v0alpha1/namespaces/<namespace>/app/instance`. Unified storage maps it to
group `plugins.grafana.app`, resource `app`, and object name `<plugin-id>`, within the same
namespace. Preserve that mapping for objects and inline secure value ownership. Manifest
kinds remain under their declared API group; `kindstore` does not need settings-specific logic.

The relevant OSS implementation is in [the settings handler](../../services/pluginsintegration/pluginroute/handler.go),
[settings registration](../../services/pluginsintegration/pluginroute/appsettings/register.go),
[the SQL adapter](../../services/pluginsintegration/pluginroute/appsettings/settings.go),
and [the cloud loader](../plugin_manifests.go).
Enterprise counterparts are `pkg/apppluginext`, `pkg/datasource/pluginclient`, and
`pkg/apiserver/hg/loaders/app_plugin_setting_loader.go` in the enterprise repository.

## Target design

The write follow-up will use the existing dual writer. This read-only stage bypasses it.

```text
Settings request
  MT router settings backend
    shared NewAppSettingsHandler
      existing dual writer
        tenant-aware remote legacy adapter -> tenant SQL settings
        unified storage -> shared settings objects and secrets
```

Deployment-specific dependencies belong in loader construction, outside the router engine.
One backend owns the plugin-ID group, including its settings and subresources. Manifest
backends retain independent keys and lifecycles.

The first enterprise adapter uses the existing cloudconfig app-settings client for reads
and rejects writes. It introduces no fresh-read endpoint or ST REST writer. Evaluate direct
SQL-proxy reads and updates for the write follow-up: the OSS SQL driver supports writes and
transactions, while the enterprise xorm adapter remains read-only. Choosing SQL-proxy access
also requires an explicit contract for encryption, concurrency, events, and cache invalidation.

Legacy storage must resolve the tenant from each operation's request context. A plugin
backend is shared across tenants; its construction context cannot select a tenant.

## Implementation sequence

### Step 1 Make the legacy settings store injectable

Implemented with this plan:

- Replace the local SQL service field in `PluginDependencies` with
  `LegacySettingsStoreProvider`, taking a construction context and plugin ID.
- Construct the existing SQL adapter in `ProvidePluginLoaderDependencies`. Its dependency
  signature stays unchanged, so the Wire graph continues to supply the same services.
- Resolve the supplied store in `PluginBackend.loadSettings` and pass it to the existing
  settings handler and dual writer.
- Fail backend loading when a configured provider errors or returns no store. An absent
  provider retains the existing unified-only behavior.
- Cover local and injected stores through HTTP reads and updates for distinct plugins,
  plus provider failure handling and the existing standalone settings gate.

This first step alone adds no MT settings route, remote client, configuration option, or
migration-mode change. The local standalone settings gate remains closed. Providers are construction-time
dependencies, not mutable configuration; replacing one requires rebuilding its backends.

### Step 2 Read settings through cloudconfig

Implemented in enterprise `pkg/routersource/legacysettings`:

- `NewStoreProvider` wraps the existing authenticated `datasource.AppPluginSettingClient`
  and matches the OSS legacy-store factory. The Wire provider constructs one authenticated
  HTTP client; no SQL connection is opened.
- Resolve tenant scope on each get/list and verify the returned object's identity.
- Preserve enabled, pinned, JSON data, creation timestamp, resource version, and the local
  adapter's UID and opaque secure-name conventions. Clone shared cached data before returning it.
- Keep plaintext secrets out of public responses and supply decrypted values through the
  existing secure-context shim for authorized backend calls.
- Return NotFound for missing cloudconfig settings. Do not synthesize a configured app.
- Reject create, update, and delete with MethodNotAllowed, including dry-run writes.
- Test tenant isolation, secret redaction, cached-object isolation, selectors, errors, and
  compatibility with the shared settings HTTP handler.

Cloudconfig's existing server-side settings and decrypted-secret caches remain in use. The
HTTP client passes app-settings reads through; it adds no separate settings cache. This is a
read-only adapter, not a completed dual-write implementation.

### Step 3 Wire MT reads and authorization

Implemented:

- The router module calls `InitializeCloudRoutesLoader` before the local-loader fallback.
  Its separate Wire graph receives already-constructed router clients, tracer, features,
  and registerer. Enterprise supplies `legacysettings.ProvideStoreProvider`; OSS supplies
  no legacy adapter. Cloud startup never invokes the local plugin loader's SQL graph.
- Enterprise reads `cloudconfig_url` and optional `cloudconfig_ca_file` from `[cloud_router]`.
  Authentication uses `[grpc_client_authentication]` token exchange and the existing internal
  cloudconfig audience policy. The client bounds requests to 30 seconds and rejects redirects.
- Modern and legacy authorization clients share the standalone AuthZ connection. App settings
  fail startup when enabled without a legacy authorization client, including deployments that
  configure Zanzana without the legacy client.
- Settings operations require a concrete stack namespace matching the caller (or wildcard
  namespace / Grafana admin privileges). Access-policy tokens need settings read scope;
  delegated callers need both token delegation scope and `plugins.app:access` on
  `plugins:id:<plugin-id>` from legacy RBAC. Namespace, subject, organization and teams are
  taken from the request, never the backend construction context.
- The shared settings handler has a read-only legacy mode. It installs only get/list storage
  interfaces and bypasses unified storage and migration modes. No settings writes or watches
  are installed or advertised. Authenticated callers can read discovery metadata.

The read-only path does not construct a dual writer or register its builder metrics. Before
writes are enabled, add a migration policy for dynamically discovered plugin IDs, resolve
`app.*-app` defaults without mutating shared maps, and register migration metrics once.

### Step 4 Publish settings backends from the cloud source

Implemented behind `[cloud_router] app_settings_enabled = true`:

- The `plugins_url` source publishes one settings backend per app plugin, including plugins
  without manifests. `core_url` and `bridge_url` do not publish settings. Existing
  `plugins_group_patterns` apply to the plugin-ID group as well as manifest groups.
- Plugin-ID validation keeps settings groups separate from core and manifest groups. Settings
  have distinct deployment fingerprints and use no raw v2 gRPC client.
- When an aggregate or ST source also offers the group, the cloud loader retains that backend
  for the `v0alpha1` singleton's health/resources/proxy subresources. Settings requests go to
  the local read-only handler. Existing fallback credentials, authorization and circuit breakers
  remain in use. With no matching HTTP backend, only settings reads are served.
- Discovery and OpenAPI come from the local settings handler. They advertise get/list and
  describe retained v2 subresources only when an HTTP fallback exists. Existing router
  namespace visibility filtering still applies; missing cloudconfig settings return NotFound.
- Composite fingerprints include the fallback's key. Replacements drain normally before
  destroying both handlers; failed loads clean up acquired resources.

Configuration for the enterprise router:

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

The service credential needs access to the cloudconfig audience. Keep the existing standalone
AuthZ client configuration and `authZGRPCServer` feature enabled. Incoming tokens need
`<plugin-id>/app:get` (or an appropriate group wildcard) directly or as delegated permissions.
To retain v2 execution, keep an aggregate or ST source advertising the same plugin-ID group.
The local ST settings flag and behavior remain unchanged.

### Step 5 Decide and implement the write path

Evaluate `pkg/storage/dbproxy/sqldriver` for parameterized queries and updates against the
tenant's SQL tables. It uses one shared authenticated gRPC connection and pool, with a concrete
stack namespace and stable query name for each operation. The existing enterprise
`pkg/storage/proxydb` adapter rejects transactions; use `database/sql` directly or extend that
adapter deliberately. Verify supporting server deployment and write-service authorization.

Preserve legacy envelope encryption and key access, secure field merge/removal, plugin
version, size validation, and plugin-state events. Define cache invalidation for ST and MT
readers, including cloudconfig's separate decrypted-secret cache. SQL-proxy transactions
currently reject `SELECT FOR UPDATE`; use a supported conflict-detection strategy and test
concurrent writers. Treat `sqldriver.ErrOutcomeUnknown` as requiring reconciliation, not an
automatic retry.

A successful write must yield authoritative state for mirroring to unified storage. Do not
read cached cloudconfig immediately after writing and assume it reflects the new values.
Cover two tenants with the same plugin ID, secret retention/removal, dry runs, conflicts,
partial failures, and uncertain commit outcomes before enabling dual writes.

### Step 6 Move v2 execution when behavior matches

Provide an MT `PluginContextWrapper` and a client with the required middleware. The cloud
loader's raw `ClientV2` currently lacks the enterprise middleware; the local context provider
requires a local plugin store. Neither can be reused unchanged.

Preserve namespace and requester propagation, tenant configuration, plugin access tokens,
ID-token forwarding/derivation, credential stripping, and per-tenant version/process
selection. Preserve proxy route authorization; enterprise currently leaves `reqAction`
routes denied unless its legacy authorization client is configured.

Resolve existing behavioral differences explicitly: enterprise's settings getter omits
`pinned` and metadata present in cloudconfig, while the shared settings handler rejects
subresource calls for disabled settings. Test frontend-only apps, raw v2 apps, and apps
with both settings and v3 manifests. Keep tenant-isolated execution in the runner.

### Step 7 Complete writer and reader migration

Inventory legacy REST, provisioning, and other settings writers. The old REST endpoint
currently bypasses dual write. Route writers through a common migration policy while
ensuring the remote legacy adapter cannot recurse into it. Account for existing validations,
plugin-state events, cache invalidation, and plugin-version fields.

Backfill existing objects and secrets, reconcile missed secondary writes, and compare state
before switching reads. Move settings consumers off SQL/cloudconfig before stopping legacy
writes. Verify that ST and MT address the same shared objects and secret ownership.

## Rollout and rollback

Enable read-only settings for one plugin using `plugins_group_patterns` and the existing
namespace visibility controls. Enable dual writes only after step 5 and the migration-policy
work described in step 3. During dual-write mode,
legacy remains authoritative and secondary writes may run
asynchronously. A successful request is not evidence that both stores committed. Monitor
secondary-write failures and reconcile them before promoting unified storage.

Before promotion, disabling the MT settings route can return traffic to the existing
enterprise/ST path if that route is still available. Once unified-only writes begin, returning
to SQL requires reverse synchronization; toggling routing alone would expose stale settings.

## Decisions before writes and further migration

1. For the write follow-up, choose SQL-proxy access or a service write API, including
   authentication, encryption, fresh-read, and concurrency contracts.
2. Choose process-wide versus tenant-scoped migration policy and enablement.
3. Plan migration from the retained HTTP v2 backend to tenant-aware plugin execution.
4. Identify every remaining legacy writer and reader, and define backfill and rollback ownership.

## Validation

- Router and shared plugin-handler suites pass, including ST settings behavior.
- Enterprise adapter tests pass, including tenant isolation and secret redaction.
- The enterprise Wire integration test discovers an app with no v3 manifest and reads its
  settings through authenticated cloudconfig.
- Targeted router and enterprise adapter race tests pass.
- AuthZ unit tests and targeted OSS/enterprise server tests pass; both Wire graphs regenerated.
- Semgrep is not installed in this checkout environment; the pre-landing scan remains outstanding.
