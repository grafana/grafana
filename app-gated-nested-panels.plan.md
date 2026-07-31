# Let an admin disable individual panels included in an app plugin

_(Revised: storage is now per-child `plugin_setting` rows, per your answer.)_

## Context

`grafana-echarts-app` bundles seven nested panel plugins, one per ECharts chart family. They will not reach GA together — relations and part-to-whole go to public preview first. A Grafana admin needs to choose which families their users can see: an internal or datasource-development instance wants everything, a customer-facing instance wants only what is GA.

Grafana has no mechanism for this today. `getFSPanels` (`pkg/api/bootdata.go:385-417`) filters nested panels on exactly one thing — `state == alpha` versus `[plugins] enable_alpha` — which is instance-wide and all-or-nothing across every plugin on the box. `[plugins] disable_plugins` cannot help: its filter matches `bundle.Primary.JSONData.ID` only (`pkg/services/pluginsintegration/pipeline/steps.go:251-269`), so it can drop a whole bundle but never a child of one. And the `Enabled` cascade that `pluginSettings()` computes for app children (`pkg/api/bootdata.go:619-626`) is never read by `getFSPanels`, so even disabling the whole app leaves all seven panels in `config.panels` and in the picker.

Outcome we want: an admin turns Heatmap off in the ECharts app's config page, and after a page reload that panel is gone from the picker, gone from the Suggestions eager-load, and any dashboard still using it degrades to Grafana's standard "Panel plugin not found" card.

### Decisions (confirmed)

1. **State lives in the child plugin's own `plugin_setting` row,** written with the existing `POST /api/plugins/<child-panel-id>/settings`. No new storage concept, no reserved `jsonData` key.
2. **A disabled panel is dropped from bootdata entirely,** mirroring the `enable_alpha` gate three lines above the new code. Failure path is `getPanelPluginNotFound` (`public/app/features/panel/components/PanelPluginError.tsx:57`), a rendered alert, so Grafana starts fine and the user can swap or delete the panel.
3. **Deny semantics** — available unless something says otherwise. Layered with what Grafana already does this covers the lifecycle story: a new family shipped as `"state": "alpha"` is _already_ invisible to any instance without `enable_alpha = true`, so it cannot surprise a production admin on upgrade. The explicit row handles what alpha-state cannot — turning off a beta or GA family.
4. **Upstream OSS PR** against `grafana/grafana` main: generic feature, Go tests, admin docs.

### The load-bearing distinction

`pluginSettings()` returns a settings entry for **every** plugin in the store, but most are invented on the spot. Only entries backed by a `plugin_setting` row represent something an operator decided. The cascade at `pkg/api/bootdata.go:619-626` synthesises `Enabled = false` for every child of a not-enabled app — and the ECharts app will be not-enabled on a normal install, since the plan there deliberately avoids `autoEnabled`.

So a gate on `!Settings.Enabled` alone would hide all seven families the moment the plugin is installed, and would retroactively hide every app-bundled panel on every existing Grafana instance. **The gate must fire only on stored rows.** That is the one non-obvious thing in this change and most of the test table exists to pin it.

### Two facts that shape the API surface

`PluginsWriter` grants `plugins:write` on `plugins:id:*` to **Org Admin** (`pkg/services/pluginsintegration/pluginaccesscontrol/accesscontrol.go:62-74`), so an admin can already POST settings for a nested panel. Nothing to add.

But **reading** the state back is broken today. `GetPluginSettingByID` seeds `dto.Enabled` from `plugin.AutoEnabled` only when `plugin.IsApp()` (`pkg/api/plugins.go:225-229`), so for a panel with no row it returns the zero value `false`. The config page cannot tell "never configured, therefore available" from "explicitly disabled" — it would render all seven switches off on a fresh install. `GET /api/plugins` is no better: it reports the synthesised cascade value. This needs a targeted fix or the feature is not usable from a config page.

**No Grafana restart is needed.** `config.panels` is recomputed per request by `getFrontendSettings`, so a browser reload suffices.

**This is exposure control, not access control.** `/public/plugins/:pluginId/*` (`pkg/api/api.go:265`) has no `checkAppEnabled` middleware, so a determined user can still fetch a disabled panel's bundle directly.

## Goal

A panel plugin included in an app is withheld from an org's frontend when an operator has explicitly disabled it for that org, and the app's config page can read that state back accurately.

## Approach

Thread one extra piece of information out of `pluginSettings()` — the set of plugin IDs with a stored row — and use it in `availablePlugins()` to mark nested panels as explicitly disabled. `getFSPanels` then skips them, beside the existing alpha gate. Separately, teach `GetPluginSettingByID` to report a nested plugin as enabled when no row exists.

Everything is inside `pkg/api/`. No shared DTO change, no SQL change, no service-interface change, no fake change, no migration, no swagger regen.

## File changes

| Path                                                      | Change     | Responsibility                                                                                                        |
| --------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `pkg/api/bootdata.go`                                     | **Modify** | Second return value from `pluginSettings()`; `ExplicitlyDisabled` on `availablePluginDTO`; the gate in `getFSPanels`. |
| `pkg/api/plugins.go`                                      | **Modify** | One-line call-site update at line 69; default `Enabled` for nested plugins in `GetPluginSettingByID`.                 |
| `pkg/api/bootdata_test.go`                                | **Modify** | Table-driven coverage of the gate.                                                                                    |
| `pkg/api/plugins_test.go`                                 | **Modify** | Coverage of the `GetPluginSettingByID` default.                                                                       |
| `docs/sources/administration/plugin-management/_index.md` | **Modify** | New `###` subsection under `## Advanced options` (line 114).                                                          |
| `conf/provisioning/plugins/sample.yaml`                   | **Modify** | Commented example disabling a nested plugin.                                                                          |

## Implementation steps

### Task 1 — surface which settings are stored

In `pkg/api/bootdata.go`, change `pluginSettings()` (lines 568-631) to return the stored set alongside the map. The doc comment is the important part — it is what stops someone later "simplifying" the gate down to `!Enabled`:

```go
// pluginSettings returns the effective settings for every plugin in the store, plus the set of plugin
// IDs that have a stored plugin_setting row for the org. Only the stored ones reflect a decision an
// operator made; everything else is a default filled in below, including the app-enabled cascade,
// which is advisory and must not be treated as an instruction to hide anything.
func (hs *HTTPServer) pluginSettings(ctx context.Context, orgID int64) (map[string]*pluginsettings.InfoDTO, map[string]bool, error) {
	...
	stored := make(map[string]bool)
	if pss, err := hs.PluginSettings.GetPluginSettings(ctx, &pluginsettings.GetArgs{OrgID: orgID}); err != nil {
		return nil, nil, err
	} else {
		for _, ps := range pss {
			pluginSettings[ps.PluginID] = ps
			stored[ps.PluginID] = true
		}
	}
	...
	return pluginSettings, stored, nil
}
```

Two call sites, both in `pkg/api/`: `bootdata.go:526` in `availablePlugins`, and `plugins.go:69` in `GetPluginList`, which takes `_`.

### Task 2 — mark and skip explicitly disabled nested panels

**2.1** Add the field to `availablePluginDTO` (lines 498-501):

```go
type availablePluginDTO struct {
	Plugin   pluginstore.Plugin
	Settings pluginsettings.InfoDTO
	// Set for panels only; see explicitlyDisabled and getFSPanels.
	ExplicitlyDisabled bool
}
```

**2.2** Add the predicate. Both clauses carry weight and both need the comment:

```go
// explicitlyDisabled reports whether an operator turned this plugin off for the org by storing a
// plugin_setting row, as opposed to Grafana defaulting it off.
//
// Restricted to plugins included in an app for two reasons: those are the only ones an operator has a
// route to disable today, and standalone panels have never been hideable this way, so leaving them
// out keeps every existing instance behaving exactly as before.
func explicitlyDisabled(p pluginstore.Plugin, s pluginsettings.InfoDTO, stored map[string]bool) bool {
	return p.IncludedInAppID != "" && stored[p.ID] && !s.Enabled
}
```

`IncludedInAppID` is on `pluginstore.Plugin` (`pkg/services/pluginsintegration/pluginstore/plugins.go:21`).

**2.3** Populate it in the panels loop of `availablePlugins` (lines 554-563):

```go
panels := make(map[string]*availablePluginDTO)
for _, p := range hs.pluginStore.Plugins(ctx, plugins.TypePanel) {
	if s, exists := pluginSettingMap[p.ID]; exists {
		panels[p.ID] = &availablePluginDTO{
			Plugin:             p,
			Settings:           *s,
			ExplicitlyDisabled: explicitlyDisabled(p, *s, storedSettings),
		}
	}
}
```

Leave the app and datasource loops alone. Applying the same filter to nested _datasource_ plugins would make `getFSDataSources` log "Could not find plugin definition for data source" and silently drop live datasource instances (`pkg/api/bootdata.go:272-276`).

**2.4** Add the gate to `getFSPanels`, directly below the alpha check so the two read as a pair:

```go
for _, ap := range availablePanels {
	panel := ap.Plugin
	if panel.State == plugins.ReleaseStateAlpha && !hs.Cfg.PluginsEnableAlpha {
		continue
	}
	if ap.ExplicitlyDisabled {
		continue
	}
	...
```

### Task 3 — make the state readable

In `GetPluginSettingByID` (`pkg/api/plugins.go:225-249`), add a default immediately after the existing `plugin.IsApp()` block and before the settings lookup that overwrites it:

```go
if plugin.IncludedInAppID != "" {
	// A plugin included in an app is exposed unless explicitly disabled, so with no stored row the
	// honest answer is enabled. Without this the response is a bare false and a config page cannot
	// tell "never configured" from "turned off". Mirrors explicitlyDisabled in bootdata.go.
	dto.Enabled = true
}
```

Scoped to `IncludedInAppID != ""` on purpose: exactly the set the new gate acts on, so responses for standalone panels and datasources stay byte-identical and no existing consumer of `dtos.PluginSetting.Enabled` changes behaviour.

### Task 4 — tests

**4.1** `pkg/api/bootdata_test.go` — add `TestIntegrationHTTPServer_GetFrontendSettings_disabledNestedPanels`, modelled on the translations test at line 556, which already decodes `Panels map[string]*plugins.PanelDTO` from the response body (line 561).

Reuse the existing harness: `setupTestEnvironment` (line 58) takes a `pluginstore.Store` and a `pluginsettings.Service`; `pluginstore.FakePluginStore` filters `PluginList` by type; and `pluginsettings.FakePluginSettings.GetPluginSettings` returns an `InfoDTO` per entry in its `Plugins` map — precisely "stored rows", so **no fake needs changing**. `newAppSettings` (line 545) builds that map.

Fixture: app `test-app` (not enabled, no `autoEnabled` — the realistic ECharts shape), panels `test-app-panel-a` and `test-app-panel-b` with `IncludedInAppID: "test-app"`, and a standalone `standalone-panel`.

| Case                                                      | Expectation                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| No stored rows for any panel                              | All three panels present — **the regression guard.** Fails loudly if the gate ever keys off `!Enabled` instead of the stored set |
| App `enabled: false`, no panel rows                       | All three present — the cascade stays advisory                                                                                   |
| Stored row `test-app-panel-a: enabled=false`              | Panel A absent; B and standalone present                                                                                         |
| Stored row `test-app-panel-a: enabled=true`               | All three present                                                                                                                |
| Stored row `standalone-panel: enabled=false`              | Still present — the feature does not reach standalone panels                                                                     |
| Panel A also `state: alpha`, `enable_alpha=false`, no row | Absent via the pre-existing gate; asserts the two gates compose rather than interfere                                            |

**4.2** `pkg/api/plugins_test.go` — for `GET /api/plugins/<id>/settings`: a nested panel with no stored row returns `enabled: true`; with a stored `enabled=false` row returns `false`; a standalone panel with no row still returns `false` (unchanged).

### Task 5 — docs

Add `### Disable an individual plugin included in an app` under `## Advanced options` (line 114) in `docs/sources/administration/plugin-management/_index.md`, following `docs/AGENTS.md`. Cover, in order:

1. Why: an app can bundle plugins at different maturity levels, and this picks which are exposed.
2. How: `POST /api/plugins/<included-plugin-id>/settings` with `{"enabled": false}`, needs `plugins:write`, granted to Org Admin by default. An app's own config page is the expected UI.
3. **Per-org** — `plugin_setting` rows are keyed `(org_id, plugin_id)`, so two orgs on one Grafana can expose different sets.
4. Effect on the next page load, no restart.
5. A dashboard already using a disabled panel shows "Panel plugin not found"; the user can change or remove the panel from there.
6. It hides the panel from the UI but does not block direct access to the plugin's assets.
7. Provisioning, with the trap.

Provisioning form, also added as a comment to `conf/provisioning/plugins/sample.yaml`. The provisioner resolves any plugin ID, not just apps (`pkg/services/provisioning/plugins/plugin_provisioner.go:52-57`), so this already works with no provisioner change — but note that the block is called `apps:` for historical reasons, and that provisioned settings are re-applied on every Grafana start, so a provisioned entry silently reverts config-page saves on restart:

```yaml
apps:
  - type: grafana-echarts-heatmap-panel
    org_id: 1
    disabled: true
```

## Plugin-side contract

For the ECharts repo — per family, on save:

```
POST /api/plugins/grafana-echarts-heatmap-panel/settings
{ "enabled": false, "pinned": false }
```

and read current state with `GET /api/plugins/<child-id>/settings` → `.enabled` (correct only once Task 3 lands; before that it returns `false` for every unconfigured family).

Consequences to design around, all following from the storage choice rather than from anything core does:

- **Seven writes, not one.** No transaction spans them, so a mid-save failure leaves a partial state. Save sequentially and re-read on failure rather than assuming the optimistic UI state is real.
- **Requires Org Admin,** since the writes are scoped per child plugin ID and the default `plugins:write` grant is `plugins:id:*` to Admin. A user granted `plugins:write` on only the app's own ID can open the config page but every save will 403. Worth a specific error message.
- **`disabledFamilies` in the app's `jsonData` is not needed** — drop it.
- **The render-time gate is obsolete** against a Grafana carrying this change: `LazyPanel`'s `FamilyDisabledNotice`, `useFamilyDisabled`, the `src/app/settings.ts` read path and the suggestions wrapper all become dead code, because the panel never reaches the picker or the renderer. Keep them only if the plugin must also support older Grafana.

## Acceptance criteria

1. On an instance with no stored panel settings rows, `GET /api/frontend/settings` returns byte-identical `panels` to before the change — including when an app bundling panels is _not_ enabled.
2. `POST /api/plugins/grafana-echarts-heatmap-panel/settings {"enabled":false,"pinned":false}` as an org-1 admin removes exactly that ID from `GET /api/frontend/settings | jq '.panels|keys'` for org-1 users, leaving the other six families.
3. An org-2 user on the same instance still sees all seven — the setting is per-org.
4. The visualization picker does not offer Heatmap; the Suggestions tab issues no request for the heatmap module.
5. A dashboard already using the heatmap panel renders "Panel plugin not found: <id>", the dashboard is editable, and the panel can be changed to another type or deleted.
6. Re-POSTing `{"enabled":true}` restores the panel after one browser reload, with no Grafana restart.
7. `GET /api/plugins/grafana-echarts-heatmap-panel/settings` returns `enabled: true` before any row exists and `false` after the disable POST.
8. `GET /api/plugins/<standalone-panel>/settings` still returns `enabled: false` with no row — unchanged.
9. A stored `enabled=false` row for a standalone panel does not remove it from `config.panels`.
10. Disabling the _app itself_ still leaves its nested panels available — unchanged from today.
11. `make lint-go` and `go test ./pkg/api/...` pass.

## Verification steps

```bash
go test -run TestIntegrationHTTPServer_GetFrontendSettings ./pkg/api/
go test -run TestPluginSetting ./pkg/api/
make lint-go
```

End-to-end, with the ECharts app installed in `data/plugins/`:

```bash
make run    # localhost:3000, admin/admin

# Task 3: reads true before any row exists
curl -s -u admin:admin localhost:3000/api/plugins/grafana-echarts-heatmap-panel/settings | jq .enabled

curl -s -u admin:admin localhost:3000/api/frontend/settings | jq '.panels|keys' > /tmp/before.json

curl -s -u admin:admin -X POST -H 'Content-Type: application/json' \
  -d '{"enabled":false,"pinned":false}' \
  localhost:3000/api/plugins/grafana-echarts-heatmap-panel/settings

curl -s -u admin:admin localhost:3000/api/frontend/settings | jq '.panels|keys' > /tmp/after.json
diff /tmp/before.json /tmp/after.json   # exactly one line removed
curl -s -u admin:admin localhost:3000/api/plugins/grafana-echarts-heatmap-panel/settings | jq .enabled  # false
```

The regression guard matters most and is easy to check by hand: before disabling anything, confirm all seven families are in `/tmp/before.json` **while the ECharts app is not enabled**. That is the case the cascade would have broken.

Then in the browser: reload, add a panel, confirm Heatmap is absent from the picker and the other six are present. Open a dashboard already using the heatmap panel and confirm the "Panel plugin not found" card renders and the panel can be swapped or deleted. Re-POST with `"enabled":true` and confirm the panel returns after a reload without restarting Grafana.

## Risks and mitigations

| Risk                                                                                                                                                                                                           | Mitigation                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The cascade trap.** A future refactor simplifies `ap.ExplicitlyDisabled` to `!ap.Settings.Enabled` and every app-bundled panel on every instance disappears.                                                 | The main hazard in the change. Doc comments on `pluginSettings` and `explicitlyDisabled` state it; two test rows fail immediately if it happens; the predicate is a named function rather than an inline condition so the comment cannot drift from the code.                                     |
| `dtos.PluginSetting.Enabled` changes value for nested plugins — an existing API response field.                                                                                                                | Scoped to `IncludedInAppID != ""`, so standalone panels and datasources are untouched. The old value was a meaningless zero value for these plugins, and the plugin-details page showing an included panel as "disabled" was arguably already a bug. Call it out in the PR description.           |
| Seven non-atomic writes from the config page; a partial save leaves mixed state.                                                                                                                               | Plugin-side, not core. Save sequentially and re-read after any failure.                                                                                                                                                                                                                           |
| Provisioning a nested plugin under a block named `apps:` is confusing.                                                                                                                                         | Works today with no provisioner change; documented explicitly rather than renamed.                                                                                                                                                                                                                |
| Under `plugins.useMTPlugins`, panel metas come from `/apis/plugins.grafana.app/...` instead of `config.panels` (`packages/grafana-runtime/src/services/pluginMeta/panels.ts:68-77`) and this gate is bypassed. | Out of scope and pre-existing: that path is an org-agnostic static meta cache (`apps/plugins/pkg/app/meta/manager.go`) with no plugin-settings awareness, so it already bypasses `enable_alpha` too. The flag is experimental and off by default. File a follow-up on `@grafana/grafana-catalog`. |
| Hiding a panel breaks dashboards that use it.                                                                                                                                                                  | Accepted and pre-approved; degrades to the same card `enable_alpha` has always produced. Documented.                                                                                                                                                                                              |
| Not a security boundary — plugin assets stay reachable at `/public/plugins/...`.                                                                                                                               | Stated in the docs. Fixing it means `checkAppEnabled`-style middleware on the asset route, a separately-motivated change.                                                                                                                                                                         |
