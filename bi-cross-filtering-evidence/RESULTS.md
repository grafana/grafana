# BI cross filtering - results

Date: 2 October 2026. Branch `sj/bi-cross-filtering` on grafana/grafana, stacked on `sj/bi-mode-toggle`
(grafana/grafana#134043). Companion Scenes change: grafana/scenes#1671. This file is the long-form record
for the pull request; it is removed again in the next commit, so link to it at this commit.

## What was built

Behind the `dashboard.biMode` feature toggle (experimental, frontend only, off by default):

- **Click to filter other panels.** A click on a bar in a bar chart whose category field is filterable
  writes an ad hoc filter. Every other panel is filtered; the clicked panel is not.
- **Multi-select.** Plain click replaces the selection (clicking the sole selected bar clears it).
  Cmd/Ctrl-click toggles a value. Shift-click adds the range from the anchor. Several values become one
  `=|` (one of) filter when the data source supports multi-value operators, otherwise the clicked value.
- **Highlight.** Selected bars keep their colours; the rest, and their value labels, are veiled in the
  panel background colour. Selection changes redraw without rebuilding the plot.
- **Symmetry.** A click in another panel filters this one; a plain click there takes ownership of a key
  that another panel was driving.
- **Tooltip.** Hover still shows it. A click no longer pins it; Alt-click does, and the unpinned
  tooltip says "Alt-click to pin".

How it works: a selection is an ordinary `=`/`=|` filter in the dashboard's ad hoc variable, stamped in
`meta.biSelection` with the selecting panel's identity, key and values. `DashboardScene` implements the
new Scenes `DataRequestFiltersEnricher` hook and leaves a panel's own valid selection out of that panel's
requests. Panel identity reuses `enrichDataRequest`'s resolution: the panel key, or a hash of the path id
for repeat clones. The stamp is stripped on save and is not in the URL.

## Pull requests

| PR | Contents |
|---|---|
| grafana/grafana#134043 | `dashboard.biMode` toggle only |
| this PR | selection API, exclusion, bar chart selection and veil, tooltip select mode, Dashboard data source `=|`/`!=|`, two latent-bug fixes, e2e |
| grafana/scenes#1671 | `DataRequestFiltersEnricher` hook |

## Commits

1. Dashboard datasource: Support one-of ad hoc filter operators
2. Dashboards: Add BI selections that filter other panels but not their source
3. BarChart: Select bars to filter other panels in BI mode
4. E2E: Cover BI cross filtering between bar charts
5. Dashboards: Fix BI selection review findings
6. BarChart: Fix BI selection review findings and dropped clicks
7. Frontend settings: Pass multiValueFilterOperators for built-in data sources
8. Dashboard datasource: Stop filter-enabled panels sharing value arrays with their source
9. E2E: Run BI cross filtering specs against a live server
10. Dashboard datasource: Copy only value arrays still shared with the source
11. Dashboards: Scope BI selection reads to the panel's data source

## Checks

| Check | Result |
|---|---|
| Focused jest: TooltipPlugin2, barchart, Dashboard data source, dashboard-scene scene, serialization, utils and bi | 897 passed, 2 skipped on the final commit (an earlier run over the whole serialization folder: 1,207 passed; `transformSaveModelV1ToV2.test.ts` cannot run in a fresh worktree because it needs Go-generated migration fixtures) |
| `go test ./pkg/services/featuremgmt/...` (PR 1) | pass |
| `go test ./pkg/api -run TestIntegrationHTTPServer_GetFrontendSettings` | pass; the new built-in case fails without the fix |
| `tsc --noEmit` (whole frontend) | clean |
| eslint, prettier on changed files | clean |
| Playwright `bi-cross-filter.spec.ts` (flag on) and `bi-cross-filter-off.spec.ts` (flag off) against a dev server | pass, 3 repeats each serially, 7/7 |
| Scenes `SceneQueryRunner.test.ts`; `variables/adhoc`, `variables/groupby`, `querying/layers`; typecheck; build | 220 passed; 648 passed; clean |

The dev server ran this branch's backend and a webpack build with the Scenes patch's `dist` copied over
`node_modules/@grafana/scenes/dist` (Grafana main pins Scenes 8.19.0). Types came from
`public/app/features/dashboard-scene/bi/scenesShim.ts`.

## Reviews

Plan: Codex and a fresh Claude reviewer before any code. Their blockers changed the design: no static panel
key in Scenes (repeats and the panel editor break it), a generic Scenes hook instead of an `origin`-based
rule (`origin` makes pills read-only and is not in the URL), forced publish for ownership-only changes,
stamping only on the new bar chart path, and a veil instead of rebuilding the uPlot config.

Code, round 1: Codex and a fresh Claude reviewer. Fixed: multi-value detection by type (blocker),
panel-editor exclusion applied to every panel (blocker), read and write resolving different variables,
first click not re-running type-only runners, stamp without its key, manual duplicate swallowed by Scenes
dedupe, PanelContext doc overstating clearing, invisible pin with the tooltip hidden, stale Shift anchor,
overlapping clicks, veil seams, bleed and label contrast, Shift text selection.

Code, round 2: Codex over the fix commits confirmed six of seven round-1 findings fixed and found one
blocker and two should-fixes, all fixed: identical dashboard and section filters lost ownership because
Scenes deduplicated before the enricher ran (now fixed in grafana/scenes#1671, which passes the enricher
in before deduplication); selection reads survived a panel's data source change; the first-variable refresh
ran manual-mode runners. Its nit (copying every array up front) is fixed by copying only arrays still shared
with the source.

## Bugs found only by running it

Unit tests passed throughout; these came from driving the feature in a browser.

1. **Every click after the first was swallowed.** The first selection adds a pill, the filter bar grows a
   row and panels move 40px down with no scroll or resize. uPlot caches the plot rect and refreshes it only
   on scroll, resize and mouseenter, so its drag detection saw a moved pointer and its capture-phase
   `drag.click` stopped the click. Fix: `u.syncRect(true)` on mousedown in TooltipPlugin2. This also
   affects today's pin-on-click after any layout shift.
2. **Built-in data sources never report multi-value support.** `PluginMetaDTO` has its own
   `multiValueFilterOperators` key that shadows the embedded plugin JSON, and bootdata only set it for data
   sources stored in the database. Fix in `pkg/api/bootdata.go`.
3. **The first filter emptied the source panel for everyone.** Dashboard panels set
   `_UNSAFE_clearPreviousFieldValues`, so Scenes empties a panel's previous value arrays in place. A
   `-- Dashboard --` panel with filters enabled shared its unfiltered arrays with the source panel; the
   first filter gave it new arrays and Scenes emptied the old ones, the source's. Every later filter change
   on the dashboard came back empty. This is a latent bug on main for "Filter for value" too. Fix: copy the
   arrays when filters are enabled.

## Screenshots

- [`0-initial.png`](0-initial.png) - before any click.
- [`1-click-north.png`](1-click-north.png) - North selected; the product chart and table filter, the region chart keeps all bars.
- [`2-cmd-click-south.png`](2-cmd-click-south.png) - Cmd-click adds South: one `region =| North, South` pill.
- [`3-click-gizmo-in-other-chart.png`](3-click-gizmo-in-other-chart.png) - a click in the product chart filters the region chart in turn; the
  table shows the intersection.

## Known gaps and follow-ups

### Must happen before merge

- [ ] Release grafana/scenes#1671, bump `@grafana/scenes` in Grafana, delete `bi/scenesShim.ts`, rerun the
      checks above against the released package. Until then the exclusion hook is never called in a real build.
- [ ] Settle the toggle owner (`@grafana/dashboards-squad` is a placeholder).

### Test and CI coverage

- [ ] The e2e specs ran against a local dev server only; CI has not run them.
- [ ] The first-click type-only re-run is unit-tested with a `runQueries` spy, not real request emission.
- [ ] No visual regression coverage of the veil.

### Functional limitations a user will hit

- [ ] Bar chart only. Other visualizations keep pin-on-click.
- [ ] Selection ownership is lost on reload and on URL navigation; the filter survives and then filters
      the source panel too.
- [ ] Panels inactive during an ownership-only change (another tab, collapsed row) re-activate with stale
      data, because Scenes compares only the filter expression on activation.
- [ ] Panels that read a selecting panel through `-- Dashboard --` are not filtered by its selection.
- [ ] Repeated panels each have their own identity; selecting in one repeat filters its siblings.
- [ ] Data sources that read filters through legacy `templateSrv.getAdhocFilters` still filter the source.
- [ ] No keyboard or touch path for Cmd, Shift or Alt clicks. On macOS Ctrl-click opens the context menu.
- [ ] Ctrl/Cmd-click zero-width annotation ranges are unavailable on BI bar charts.
- [ ] With the tooltip hidden, Alt-click does nothing (no pinned tooltip to show).
- [ ] A selection write replaces every editable `=`/`=|` filter on its key, including manual ones.
- [ ] Without multi-value operator support only the clicked value is kept.
- [ ] Tableau thickens the stroke of the selected bar and animates other panels; neither is here.

### Data-model inconsistencies

- [ ] Ownership lives in filter `meta`, which Scenes treats as opaque; a Scenes-native notion of a
      filter's source panel would be cleaner.

### Retained tech debt

- [ ] `bi/scenesShim.ts` until the Scenes bump.
- [ ] The veil is painted with the theme's primary background, which shows as tinted boxes on transparent
      panels; the theme is captured at config build.
- [ ] A selection change re-runs the source panel's query with unchanged effective filters.

### Operational

- [ ] Running locally needs the Scenes `dist` copy described under Checks.
- [ ] `yarn start` watch-mode eslint reports existing baseline-suppressed errors in uPlot files; harmless.

## Running it locally

```bash
git -C ~/fana/scenes fetch origin sj/adhoc-filter-source-panel-exclusion
# build Scenes: yarn build in packages/scenes, then copy packages/scenes/dist over
# grafana/node_modules/@grafana/scenes/dist
make build-go && yarn start
GF_FEATURE_TOGGLES_ENABLE=dashboard.biMode ./bin/grafana server
# import e2e-playwright/dashboards/BiCrossFilterTest.json (needs a testdata data source with uid gdev-testdata)
GRAFANA_URL=http://localhost:3000 yarn playwright test --project=dashboards e2e-playwright/dashboards-suite/bi-cross-filter
```
