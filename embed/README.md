# @grafana/embed (prototype)

`<grafana-panel>`: one Grafana panel as a portable custom element. Panel JSON in,
Grafana pixels out, inside someone else's page.

```html
<script src="grafana-embed.js"></script>
<grafana-panel id="p" height="260" from="now-1h" to="now"></grafana-panel>
<script>
  p.panel = someDashboardV2PanelElement; // or classic v1 panel JSON
  p.frames = myFrames; // or p.dataProvider = { subscribe, query }
  p.addEventListener('timerangechange', (e) => console.log(e.detail));
  p.refresh(); // re-resolve a relative range and re-query
</script>
```

One JS file, no stylesheet to link, no `window.grafanaBootData`, no module
federation, no datasource.

## Why this is a build target and not a package

`embed/` sits at the repo root rather than under `packages/` because it is allowed to
depend on both `packages/*` and `public/app/*`. Panel components are not published
anywhere; the embed's bundler statically links them at build time, so **consumers get
the built artifact and never import `app/`**. A library under `packages/` sitting on
top of `public/app/` would invert Grafana's dependency direction and trip
`import/no-extraneous-dependencies` (`eslint.config.js`).

`embed/` is intentionally not a yarn workspace yet: it builds against the root install,
so it adds nothing to `yarn.lock`.

```bash
cd embed
../node_modules/.bin/vite build      # or: yarn build
node scripts/typecheck.mjs           # or: yarn typecheck
```

## How it works

| Concern            | Approach                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render core        | Mirrors `public/app/features/panel/components/PanelRenderer.tsx`, already Grafana's standalone single-panel renderer (Explore and alerting preview use it). Drops `getTemplateSrv` and `appEvents`; resolves plugins from a static registry instead of the async importer.                                                                                                                                     |
| Field config       | `standardFieldConfigEditorRegistry` and `standardEditorsRegistry` are initialized with the **real value definitions and stub editors** (`src/render/registries.ts`). A `FieldConfigPropertyItem` fuses value semantics with two React editors; an embed renders panels and never edits them, so it needs only the value half. This is what makes `fieldConfig.overrides` work with no editor UI in the bundle. |
| Panel plugin       | Built by hand as `new PanelPlugin(TimeSeriesPanel).useFieldConfig(getGraphFieldConfig(...))` rather than importing `module.tsx`, which is options-editor UI. Same approach as `ExploreGraph.tsx`.                                                                                                                                                                                                              |
| Shadow DOM styling | Emotion's module singleton writes to `document.head` and has no cache to retarget, so the embed mirrors those rules into a constructed stylesheet that every shadow root adopts (`src/styles/shadowStyles.ts`). Needs no change to grafana-ui.                                                                                                                                                                 |
| Theming            | Reads CSS custom properties off the element and maps them onto `createTheme` inputs (`src/theme/fromCssVars.ts`). Token names are the MCP Apps host style variables, so a panel adopts an agent host's palette with no code change.                                                                                                                                                                            |
| Data               | The host's job, always (`src/data/types.ts`). Decoders for Grafana's real wire format are in `src/data/decode.ts`.                                                                                                                                                                                                                                                                                             |

Two deliberate omissions. The element renders **the panel body only**: Grafana's
`TimeRangePicker` and `RefreshPicker` emit legacy class names served by the app's
global SCSS bundle, and time range is a host concern anyway, which is what lets one
host control drive several panels. And the element never fetches: no datasource, no
token, no network.

## Verify

`harness/index.html` is a deliberately hostile host page: `box-sizing: content-box
!important` on everything, Comic Sans, `line-height: 3`, magenta text. It asserts 10
things in-page, including the ones that fail silently.

```bash
cd embed && python3 -m http.server 8955
# open http://localhost:8955/harness/index.html
```

Current state: 10/10 pass. Bundle is 2.70 MB raw, 587 KB gzipped, for one panel type.

The harness waits for a condition rather than a fixed delay, and cache-busts both
itself and the bundle, because asserting against a stale build was the more confusing
failure of the two.

## Known gaps

Measured, not fixed. All are upstream issues the prototype surfaces.

- **Click-outside handlers break under event retargeting.** Roughly 15 handlers in
  grafana-ui attach to `document` and test `.contains(event.target)`, which retargets
  to the host element from inside a shadow root. Two are on the timeseries path:
  `TooltipPlugin2.tsx` (tooltip pinning and dismiss) and
  `XAxisInteractionAreaPlugin.tsx` (x-axis drag). Upstream fix is
  `event.composedPath()`. `ClickOutsideWrapper`'s `parent` prop is typed
  `Window | Document`, too narrow to accept a `ShadowRoot`.
- **`VizLayout` reads `document.body.clientWidth`** for the legend breakpoint, so a
  narrow embed on a wide page can pick the wrong legend placement.
- **`utils/scrollbar.ts` measures against `document.body`**, feeding tooltip viewport
  clamping.
- **Portals leave the shadow root.** `getPortalContainer()` falls back to
  `document.body`, so tooltips render outside the boundary. They are still styled,
  because emotion's rules live in `document.head`, and escaping overflow clipping is
  usually what you want. Worth a decision rather than an accident.
- **Icons do not load.** `Icon` fetches SVGs at runtime from Grafana's public dir.
  Nothing on the timeseries body path needs one, so this is currently invisible. The
  earlier spike solved it by monkeypatching `window.fetch` globally, which is not
  acceptable for a library; the real fix is bundleable icon components.
- **Fonts must be installed by the host.** `@font-face` inside a shadow root is
  ignored by spec. `installFonts()` is exported for hosts that have Grafana's font
  files; in an MCP App, use the SDK's `applyHostFonts` instead.
- **`text.maxContrast` is not mapped** from host tokens, so legend labels stay
  pure white or black rather than taking the host's text colour exactly.
- **One theme per page.** `config.theme2` in the runtime shim is a module global, so
  panels with different themes on one page fight over it and panel code that reads it
  rather than the React theme context can resolve the wrong colours. The shim now
  warns once when it sees mounted panels disagree, instead of failing silently.
  Fixing it properly means threading a theme through grafana-ui's `config` reads.
- **GraphNG needs changing props to initialize.** It rebuilds its uPlot config only
  when props change, so handing it a referentially stable `PanelData`/`TimeRange`
  leaves the plot area empty while the legend and layout still render. `timeRange()`
  therefore resolves fresh on every render on purpose, and anything that needs a
  stable window key uses the raw range instead. This is the same underlying fragility
  as the `structureRev` gate and would be worth fixing upstream together.
- **One panel type.** timeseries only. The registry and styling work is shared, so a
  second type is cheap; adding types early would hide the questions that matter.

## Not in scope

Editing, full dashboards and layouts, framework wrappers, a stable public API, auth
for direct `/api/ds/query`, and data locality.
