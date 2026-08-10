# Investigation: gcom_install_hook vs SSS Drift (OSS Code Paths)

**Incident**: freemanapps, stack ID 536006, cluster prod-us-central-0, 2026-08-04  
**Plugin**: `marcusolsson-treemap-panel`  
**Feature toggle**: `pluginInstallAPISync=true`

---

## 1. OSS Plugin Install/Provision Code Paths and the Storage Hook Interface

### 1.1 Plugin Installation Pathways (OSS)

There are three primary ways plugins get installed in OSS Grafana:

1. **Admin API** (`pkg/api/plugins.go:469–536`)  
   - `InstallPlugin` handler calls `hs.pluginInstaller.Add(ctx, pluginID, dto.Version, compatOpts)`
   - `UninstallPlugin` handler calls `hs.pluginInstaller.Remove(ctx, pluginID, plugin.Info.Version)`
   - The `pluginInstaller` is `*manager.PluginInstaller` (`pkg/plugins/manager/installer.go`)

2. **Background Preinstall** (`pkg/services/pluginsintegration/plugininstaller/service.go:40–179`)  
   - Reads `cfg.PreinstallPluginsSync` and `cfg.PreinstallPluginsAsync` from settings
   - These come from `[plugins] preinstall` / `preinstall_sync` ini sections and `GF_INSTALL_PLUGINS` env var
   - In cloud, `hgrun` populates these via the launch config / env vars
   - Calls the same `pluginInstaller.Add()` path

3. **Plugin Store Service Loading** (`pkg/services/pluginsintegration/pluginstore/store.go:42–67, 100–119`)  
   - When `pluginStoreServiceLoading=true`, the store loads plugins on startup as a background service
   - Iterates all `pluginSources.List(ctx)` and calls `pluginLoader.Load(ctx, src)` for each
   - Each plugin goes through the pipeline: discovery → bootstrap → validation → initialization → registration

### 1.2 The Plugin Registration Pipeline

The initialization pipeline (`pkg/services/pluginsintegration/pipeline/pipeline.go:69–87`) runs these steps:
1. External service registration
2. Backend client init + process start
3. Role/action-set registration
4. Build/target/FS/asset/provisioning metrics
5. **`PluginRegistrationStep`** (`pkg/plugins/manager/pipeline/initialization/steps.go:100–122`)

The registration step uses logger `"plugins.registration"` and logs:
```
r.log.Info("Plugin registered", "pluginId", p.ID)
```
This matches the `plugins.registration` log lines seen in the incident.

### 1.3 The Kubernetes-style Plugin Install API (App SDK)

The `apps/plugins/` app defines a K8s-style resource `plugins.grafana.app/v0alpha1/Plugin` with spec:
```go
type PluginSpec struct {
    Id       string  `json:"id"`
    Version  string  `json:"version"`
    Url      *string `json:"url,omitempty"`
    ParentId *string `json:"parentId,omitempty"`
}
```

### 1.4 The Storage Hook Interface (where enterprise gcom_install_hook.go connects)

**File**: `apps/plugins/pkg/app/plugin_storage.go:63–83`

Two hook provider interfaces:

```go
// Pre-commit hooks (mutations persisted with the storage operation)
type PluginStorageBeginHookProvider interface {
    BeginCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.CreateOptions) (genericregistry.FinishFunc, error)
    BeginUpdate(ctx context.Context, plugin, oldPlugin *pluginsv0alpha1.Plugin, options *metav1.UpdateOptions) (genericregistry.FinishFunc, error)
}

// Post-commit hooks (mutations not persisted; errors only logged, never surfaced to caller)
type PluginStorageAfterHookProvider interface {
    AfterCreate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.CreateOptions) error
    AfterUpdate(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.UpdateOptions) error
    AfterDelete(ctx context.Context, plugin *pluginsv0alpha1.Plugin, options *metav1.DeleteOptions) error
}
```

**Registration** (`apps/plugins/pkg/app/app.go:76–81`):
```go
type PluginAppInstallerConfig struct {
    // ...
    WrapPluginStorageAfterHooks func(base PluginStorageAfterHookProvider) PluginStorageAfterHookProvider
}
```

**How the enterprise layer hooks in**: In OSS (`pkg/registry/apps/plugins/register.go:73–77`), `WrapPluginStorageAfterHooks` is **NOT set** (nil). The enterprise layer overrides `PluginAppInstallerConfig` and provides a wrapper function that decorates the base `AfterHookProvider` with the `gcom_install_hook.go` implementation. This wrapper receives each `AfterCreate`, `AfterUpdate`, `AfterDelete` callback and records the install/uninstall with gcom.

**Key detail** (`apps/plugins/pkg/app/plugin_storage.go:93–108`): The `newPluginStorage` function applies the wrapper:
```go
func newPluginStorage(wrapped rest.Storage, logger logging.Logger, metaManager *meta.ProviderManager,
    wrapAfter func(base PluginStorageAfterHookProvider) PluginStorageAfterHookProvider) (rest.Storage, error) {
    // ...
    afterHooks := PluginStorageAfterHookProvider(hookProvider)
    if wrapAfter != nil {
        afterHooks = wrapAfter(afterHooks)
    }
    registerPluginStorageHooks(store, logger, beginHooks, afterHooks)
    return store, nil
}
```

The after-hooks run in a **fire-and-forget context** with a 30s timeout (`pluginStorageHookTimeout = 30 * time.Second`, line 40). The hook context is created fresh and disconnected from the caller:
```go
func newPluginStorageHookContext(namespace string, operation string, logger logging.Logger) (context.Context, func(error)) {
    ctx := identity.WithServiceIdentityForSingleNamespaceContext(context.Background(), namespace)
    ctx, cancel := context.WithTimeout(ctx, pluginStorageHookTimeout)
    // ...
}
```

This means the **gcom_install_hook.go's After hooks fire asynchronously** after each Plugin resource write, and their success/failure does NOT affect the actual K8s resource state.

### 1.5 What the OSS Hooks Do (child plugins and dependencies)

The default `pluginStorageHookProvider` (`apps/plugins/pkg/app/plugin_storage.go:86–290`) handles:
- **BeginCreate/BeginUpdate** (pre-commit): normalizes plugin ID, stamps `applied-children` and `applied-dependencies` annotations from plugin metadata lookup
- **AfterCreate/AfterUpdate** (post-commit): reconciles child plugins (for app plugins) and dependency plugins by creating/updating/deleting sibling K8s resources
- **AfterDelete** (post-commit): deletes child plugins and removes dependency-parent references

---

## 2. Plugin Drift/Reconciliation Logic

### 2.1 The Install Sync Service (`pluginInstallAPISync`)

**File**: `pkg/services/pluginsintegration/installsync/syncer.go`

The `syncer` is a **background service** (`plugins.installsync`) that runs once on startup:

```go
func (s *syncer) running(ctx context.Context) error {
    // Wait for the plugins.grafana.app API to become available
    discoveryClient.WaitForAvailability(ctx, pluginsv0alpha1.PluginKind().GroupVersionKind().GroupVersion())

    // Push ALL local plugins to the K8s-style Plugin API
    s.Sync(ctx, install.SourcePluginStore, s.pluginsStoreService.Plugins(ctx))

    <-ctx.Done()
    return nil
}
```

**Critical flow** (lines 145–203):
1. Reads ALL plugins from `s.pluginsStoreService.Plugins(ctx)` (the local plugin registry)
2. Filters to primary plugins only (excludes child plugins and included-in-app plugins)
3. For each org/namespace, calls `installRegistrar.SyncNamespace(ctx, namespace, source, desired)`

### 2.2 The SyncNamespace Reconciliation Loop

**File**: `apps/plugins/pkg/app/install/registrar.go:290–363`

`SyncNamespace` performs a multi-pass reconciliation:
```go
for pass := 0; pass < maxSyncNamespacePasses; pass++ {  // max 5 passes
    // List all existing Plugin resources from K8s API
    existing := client.ListAll(ctx, namespace, ...)

    // Unregister records NOT in desired set (from a different source)
    for each existing not in desired:
        unregister(...)

    // Register/update records that ARE in desired set
    for each desired:
        if shouldUpdate(existing):
            register(...)

    // If no writes happened, converged → return
    if len(written) == 0: return nil
}
```

This multi-pass loop exists because **each write fires storage hooks** (AfterCreate/AfterUpdate/AfterDelete) that can create/modify sibling records (child plugins, dependencies). The loop re-reads after writes to let the system settle.

### 2.3 The `unregister` Logic and Source Gating

**File**: `apps/plugins/pkg/app/install/registrar.go:384–453`

When unregistering:
- If the record's `install-source` annotation differs from the requester's source → **skip** (don't delete another source's record)
- If the record has `dependency-parents` → **demote** to a dependency-plugin record instead of deleting
- Otherwise → **delete** the record

This source-gating is critical: if SSS writes records with one source (e.g., `"provisioned"` or enterprise-managed) and the install-sync writes with source `"plugin-store"`, they won't interfere with each other's records... **unless the same plugin appears with different sources or the source annotation gets mismatched**.

### 2.4 How `marcusolsson-treemap-panel` Could Enter a Drift Loop

The key mechanism:

1. **SSS sees the plugin should be installed** (it's in the stack's desired state) and triggers hgrun to install it
2. **hgrun installs it** via the preinstall mechanism → plugin loads → `PluginRegistrationStep` logs "Plugin registered" → the plugin appears in `pluginStore.Plugins(ctx)`
3. **The install-sync service** pushes this plugin to the K8s Plugin API with source `"plugin-store"`
4. **The enterprise After hook** (`gcom_install_hook.go`) fires on the API write and attempts to record the install with gcom
5. **SSS's drift detector** reads the K8s Plugin API (or gcom's state) and compares against desired state
6. If there's a mismatch (timing, version, or the "already_installed" status meaning gcom thinks it's already there but SSS doesn't see it yet, or vice versa), SSS issues a correction
7. The correction restarts the pod → the plugin loads again → install-sync fires again → hooks fire again → **loop**

The `operation=delete, status=already_installed` metric dominating (peak 2176 ops) suggests the gcom hook's `AfterDelete` was being called repeatedly for a plugin that gcom already considers uninstalled, returning "already_installed" (or more precisely, "already deleted/not installed") without actually changing gcom state, but SSS kept re-triggering because the K8s API state and SSS's expectation didn't converge.

---

## 3. How `pluginInstallAPISync=true` Changes the Source of Truth

### 3.1 Without `pluginInstallAPISync`

- Plugins are local-only: loaded from disk by the plugin store
- No K8s-style API resources exist for plugin installs
- SSS/hgrun relies on its own tracking (launch_config provisioned list, gcom catalog state) to know what should be installed
- The gcom_install_hook has no trigger path (the Plugin API isn't being written to)

### 3.2 With `pluginInstallAPISync=true` (+ `pluginStoreServiceLoading=true`)

Both toggles required: `syncer.IsDisabled()` returns true unless both are on (`syncer.go:117–121`):
```go
func (s *syncer) IsDisabled() bool {
    syncEnabled := s.featureToggles.IsEnabled(ctx, featuremgmt.FlagPluginInstallAPISync)
    serviceLoadingEnabled := s.featureToggles.IsEnabled(ctx, featuremgmt.FlagPluginStoreServiceLoading)
    return !syncEnabled || !serviceLoadingEnabled
}
```

With both enabled:
1. **The K8s Plugin API becomes the authoritative record** of what's installed
2. The install-sync pushes local plugin state → K8s API on every startup
3. Every write to the K8s API fires storage hooks (including the enterprise gcom_install_hook)
4. SSS can now watch/list the K8s Plugin API to determine installed state

### 3.3 The Race/Consistency Window

The fundamental consistency problem:

```
Timeline of a pod restart:
  t0: Pod starts
  t1: Plugin store loads plugins from disk (async, takes seconds)
  t2: Plugin store service reaches Running state
  t3: Install-sync starts, waits for Plugin API availability
  t4: Install-sync reads pluginStore.Plugins() and pushes to K8s API
  t5: After-hooks fire (gcom_install_hook records with gcom)
  t6: SSS reads K8s API state / gcom state
```

**Race window**: Between t0 and t4, the K8s Plugin API may contain stale state from the previous pod's writes. If SSS reads during this window, it sees the old state. If the plugin was being added/removed, SSS sees an inconsistency and triggers a correction.

**Amplification**: Each SSS correction triggers a pod restart (withRestart=true), which resets the timeline back to t0. If the install-sync hasn't fully converged before SSS's next check (~90s), the cycle repeats.

### 3.4 The `SyncNamespace` Multi-Pass as an Amplifier

The multi-pass loop in `SyncNamespace` (max 5 passes, `registrar.go:302`) can itself cause multiple writes per sync. Each write fires After hooks, and the After hooks create/modify dependency records, which count as writes, triggering another pass. For a plugin with dependencies, a single sync can produce N writes and N hook invocations.

If the gcom hook's response or side-effects cause SSS to see inconsistency (e.g., "already_installed" means gcom didn't change state, but the K8s record DID get created/updated), SSS will detect drift and issue another correction.

### 3.5 The "already_installed" Metric Meaning

The enterprise `gcom_install_hook.go` likely has logic:
1. On `AfterCreate`/`AfterUpdate`: check if gcom already knows about this plugin install → if yes, increment `operation=create/update, status=already_installed` and return without doing anything
2. On `AfterDelete`: check if gcom already has this plugin marked as uninstalled → if yes, increment `operation=delete, status=already_installed`

The peak of `operation=delete, status=already_installed` (2176 ops) means the hook's `AfterDelete` was being invoked repeatedly for a plugin that gcom already considers not-installed. This happens when:
- The install-sync's `unregister()` deletes the K8s Plugin record
- The After hook fires and tries to tell gcom "this was deleted"
- gcom says "it's already not installed" → metric incremented
- But SSS still sees a discrepancy and triggers another restart
- The plugin gets re-loaded from disk (it's still provisioned/preinstalled) → install-sync creates the record again → SSS sees it shouldn't be there → correction → delete → loop

---

## Summary: Root Cause Hypothesis

The drift loop for `marcusolsson-treemap-panel` is caused by a disagreement between:

1. **Local disk state**: The plugin IS on disk (preinstalled/provisioned by hgrun) → it loads into the plugin store → install-sync pushes it to the K8s API as "installed"
2. **SSS desired state**: SSS believes the plugin should NOT be installed (or should be a different version) → issues "Deleting" correction with restart
3. **The restart reloads the plugin from disk** (because it's still physically present in the preinstall source) → install-sync pushes it back → SSS deletes again → loop

The `gcom_install_hook.go` is a **symptom amplifier** (not root cause): it fires on every K8s API write but its "already_installed" response indicates it's not actually changing gcom state. The real source of truth disagreement is between the physical plugin presence on disk (managed by hgrun's preinstall list) and SSS's desired-state model.

---

## Key Code Pointers

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| Install-sync service | `pkg/services/pluginsintegration/installsync/syncer.go` | 117–203 | Feature gate, startup sync, namespace iteration |
| InstallRegistrar | `apps/plugins/pkg/app/install/registrar.go` | 183–453 | K8s Plugin API CRUD, SyncNamespace multi-pass |
| Storage hook interface | `apps/plugins/pkg/app/plugin_storage.go` | 63–108 | Begin/After hook providers, enterprise wrapper injection |
| Default hooks (child/dep) | `apps/plugins/pkg/app/plugin_storage.go` | 225–290, 302–556 | Child/dependency reconciliation causing cascading writes |
| Enterprise hook injection | `apps/plugins/pkg/app/app.go` | 76–81 | `WrapPluginStorageAfterHooks` field in config |
| OSS registration (no wrapper) | `pkg/registry/apps/plugins/register.go` | 73–77 | OSS sets no wrapper; enterprise overrides |
| Plugin registration step | `pkg/plugins/manager/pipeline/initialization/steps.go` | 100–122 | "Plugin registered" log line |
| Background preinstall | `pkg/services/pluginsintegration/plugininstaller/service.go` | 99–170 | Preinstall from config (hgrun populates) |
| Plugin store service | `pkg/services/pluginsintegration/pluginstore/store.go` | 42–119 | Plugin loading with `pluginStoreServiceLoading` |
| Feature toggles | `pkg/services/featuremgmt/toggles_gen.go` | 685–699 | `FlagPluginInstallAPISync`, `FlagPluginStoreServiceLoading` |
| Hook timeout/context | `apps/plugins/pkg/app/plugin_storage.go` | 40, 800–816 | 30s timeout, fire-and-forget context |
| Source annotation gating | `apps/plugins/pkg/app/install/registrar.go` | 369–375, 414–417 | Source mismatch prevents cross-source interference |
| Metrics (OSS app) | `apps/plugins/pkg/app/metrics/metrics.go` | 10 | namespace="plugins_app" (same as gcom hook) |
