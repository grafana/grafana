# Custom panel

The custom panel draws panel data with JavaScript stored in the panel options (`options.code`).
Data comes from the panel's normal queries, including the `-- Dashboard --` datasource that reuses
the results of other panels. The code only draws: it cannot query, fetch or call any Grafana API.

Because the code lives in the dashboard JSON it is diffable and reviewable like any other panel
option. The panel adds no schema: it is a regular panel with type `custom-panel` and an opaque options
object, so it survives dashboard schema v2 to v1 to v2 conversion unchanged.

The panel is in **alpha**. It is only available when alpha panels and the `grafana.customPanel`
feature flag are both enabled:

```ini
[plugins]
enable_alpha = true

[feature_toggles]
grafana.customPanel = true
```

## Drawing API

The drawing API is a serializable subset of Grafana's [`PanelProps`](../../../../../packages/grafana-data/src/types/panel.ts)
with the same names and shapes. Functions cannot cross the sandbox, so they become URLs: state is read
from `ctx.location`, actions are `<a href>` links. Code written against `PanelProps` docs mostly
carries over; the [deviations](#relation-to-panelprops) are listed below.

### Quick start

The code runs once when the frame starts and must call `panel.onRender(draw)` at the top level. The
frame calls `draw(ctx)` for every change of data, time range, URL, theme or size. `draw` may return
a promise; the frame waits for it before it reports the draw as complete.

```js
function escapeHtml(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => escapes[c]);
}

panel.onRender(({ root, data }) => {
  root.innerHTML = data.series
    .map((frame) => {
      const field = frame.fields.find((f) => f.type === 'number');
      const display = field?.state.lastNotNullDisplay;
      const text = display ? (display.prefix ?? '') + display.text + (display.suffix ?? '') : '–';
      return '<p>' + escapeHtml(field?.state.displayName ?? frame.refId) + ': ' + escapeHtml(text) + '</p>';
    })
    .join('');
});
```

The editor's **Insert template** menu has three starting points: a KPI briefing (one card per
source panel with a sparkline and the change over the range), an incident layout (switches to an
incident view when a metric crosses its last threshold, or when the `incident_mode` variable is
`on` in the URL), and a blank template.

### `ctx`

| Field         | Type                                              | Same as `PanelProps`  | Notes                                                                                     |
| ------------- | ------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `id`          | `number`                                          | yes                   | Panel id in the dashboard.                                                                |
| `title`       | `string`                                          | yes                   | Panel title as `PanelProps` passes it: not interpolated, so it can contain `${var}`.      |
| `data`        | `{ state, series, timeRange, errors }`            | subset of `PanelData` | `request` and the deprecated `error` are not sent. See [data shape](#data-shape).         |
| `timeRange`   | `{ from: number, to: number, raw: { from, to } }` | shape only            | `from`/`to` are epoch ms, not `DateTime`. `raw` holds strings (`now-6h`, or an ISO date). |
| `timeZone`    | `string`                                          | resolved              | Always an IANA zone or `UTC`, never `browser`, so it can go straight into `Intl`.         |
| `options`     | `object`                                          | yes                   | Panel options without `code` and `apiVersion`. Empty today.                               |
| `fieldConfig` | `FieldConfigSource`                               | subset                | Display keys only, as in `field.config` below. Overrides keep `matcher` and `properties`. |
| `width`       | `number`                                          | yes                   | Pixels.                                                                                   |
| `height`      | `number`                                          | yes                   | Pixels. Do not rely on it when `fitContent` is true.                                      |
| `transparent` | `boolean`                                         | yes                   |                                                                                           |
| `fitContent`  | `boolean`                                         | yes                   | The panel sizes to its content; the frame reports its height.                             |
| `root`        | `HTMLElement`                                     | addition              | `<div id="root">`, kept between draws; `draw` owns its content.                           |
| `location`    | `{ pathname: string, search: string }`            | addition              | The dashboard URL. See [URL state](#url-state).                                           |

`panel.apiVersion` is the [drawing API version](#versioning) the panel runs.

### Data shape

`data.series` are `DataFrame`s: `{ name, refId, meta, fields, length }`. Each field is
`{ name, type, values, labels, config, state }`:

- `values`: time values are epoch ms (as in core), `NaN` and `Infinity` become `null`, objects become
  JSON strings, strings over 1,024 characters are cut with `…`.
- `config`: the `FieldConfig` keys `displayName`, `displayNameFromDS`, `description`, `unit`,
  `decimals`, `min`, `max`, `interval`, `noValue`, `mappings`, `thresholds` and `color`. Named
  colors (`green`, `semi-dark-red`) in thresholds, the fixed color and value mappings are resolved
  to CSS colors, and the `-Infinity` base threshold step is `null`, as in saved dashboards.
  `links`, `actions` and `custom` are not sent.
  The values are the field config after the Custom panel's own **Standard options** and
  **Overrides** (unit, decimals, min, max, display name, color scheme, thresholds, value mappings,
  no value) are applied, as in every core panel: a value the datasource set on the field wins over
  the panel default, and an override wins over both. Frames from a `-- Dashboard --` query are the
  source panel's query results, with the source panel's standard options (unit, decimals, min,
  max, no value, thresholds, value mappings, color scheme) filled in on each non-time field the
  datasource left unset, so they read as on the source panel. They come in like values the
  datasource set: they win over the Custom panel's defaults, and its overrides still win over them.
  The source panel's overrides are not carried.
- `state.displayName`: the display name other panels show, as core computes it.
- `state.lastNotNullDisplay` (addition): `field.display(lastNotNull)` as a `DisplayValue`
  `{ text, numeric, prefix?, suffix?, color?, percent? }`, with `numeric` `null` for non-numbers.
  Time fields only get `text` and `numeric`: a time has no place on a min/max scale or a threshold.
- `data.errors` are `{ message, refId? }`, as `DataQueryError`.
- `meta` only carries the source panel of a `-- Dashboard --` frame, where core puts it:
  `meta.custom.dashboardSourcePanelId`, `meta.custom.dashboardSourcePanelTitle` (interpolated as the
  panel header shows it) and `meta.custom.dashboardSourceRefId`. Other meta (executed query, stats,
  notices) is not sent.
- A `-- Dashboard --` frame has the `refId` of the Custom panel's own query that asked for it, so a
  `byFrameRefID` override or a `refId` check in the code matches it. The `refId` it had on the source
  panel, which collides across source panels, is in `meta.custom.dashboardSourceRefId`.

```json
{
  "name": "cpu",
  "refId": "B",
  "meta": {
    "custom": { "dashboardSourcePanelId": 2, "dashboardSourcePanelTitle": "CPU usage", "dashboardSourceRefId": "A" }
  },
  "length": 2,
  "fields": [
    {
      "name": "time",
      "type": "time",
      "values": [1767225600000, 1767225660000],
      "config": {},
      "state": { "displayName": "time" }
    },
    {
      "name": "value",
      "type": "number",
      "values": [41.2, 87.5],
      "labels": { "host": "web-1" },
      "config": {
        "unit": "percent",
        "decimals": 1,
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": null, "color": "#73BF69" },
            { "value": 80, "color": "#F2495C" }
          ]
        }
      },
      "state": {
        "displayName": "value web-1",
        "lastNotNullDisplay": { "text": "87.5", "suffix": "%", "numeric": 87.5, "color": "#F2495C" }
      }
    }
  ]
}
```

**Formatting.** `field.display()` cannot cross the frame, and Grafana's unit catalog (bytes,
durations, rates, currencies) is too large to reimplement in drawing code. The host therefore
formats the one value most drawings show, the last non-null value, with the field's real display
processor (unit, decimals, mappings, thresholds and color). Any other value is formatted by the code,
with `Intl.NumberFormat` and `config.unit` / `config.decimals` as hints.

### Relation to `PanelProps`

`ctx` is `PanelProps` minus what cannot be serialized: same names, same shapes, functions replaced by URLs.

| `PanelProps` member                          | Custom panel                                      | Status   | Why                                                                        |
| -------------------------------------------- | ------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `data`                                       | `data` (`state`, `series`, `timeRange`, `errors`) | Same     | `series` keep the `DataFrame` shape; `request` is not needed to draw.      |
| `id`, `title`, `width`, `height`, `timeZone` | same names                                        | Same     | `timeZone` is resolved to an IANA zone.                                    |
| `transparent`, `fitContent`                  | same names                                        | Same     |                                                                            |
| `options`, `fieldConfig`                     | same names                                        | Same     | `options` without `code`; `fieldConfig` without links, actions and custom. |
| `timeRange`                                  | `timeRange`                                       | Deviates | `from`/`to` are epoch ms: `DateTime` is not serializable.                  |
| `field.display()`                            | `field.state.lastNotNullDisplay`                  | Replaced | Functions cannot cross the frame; the host formats the last value.         |
| `replaceVariables`                           | `ctx.location`                                    | Replaced | Variables are URL-synced (`var-<name>`).                                   |
| `onChangeTimeRange`                          | `<a href="?from=…&to=…">`                         | Replaced | Actions are links Grafana validates.                                       |
| `onOptionsChange`, `onFieldConfigChange`     | none                                              | Dropped  | Drawing code never changes the saved dashboard, by design.                 |
| `eventBus`                                   | none                                              | Dropped  | No shared tooltips or cross-panel events across the sandbox.               |
| `renderCounter`                              | none                                              | Dropped  | Internal in core; every change triggers a draw anyway.                     |
| none                                         | `root`                                            | Addition | The element to draw in; a React panel gets it from JSX.                    |
| none                                         | `location`                                        | Addition | The read side of URL state.                                                |
| none                                         | `field.state.lastNotNullDisplay`                  | Addition | See formatting above.                                                      |
| none                                         | `panel.apiVersion`                                | Addition | Lets the code check which contract it runs against.                        |

### URL state

Dashboard variables, the time range, the open tab and `viewPanel` are synced to the URL, so
`ctx.location` is the read side of that state and links are the write side.

| Recipe                 | Code                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| Read a variable        | `new URLSearchParams(location.search).get('var-env')`                           |
| Read a multi-value one | `new URLSearchParams(location.search).getAll('var-host')`                       |
| Read the time range    | `ctx.timeRange.from` / `.to` (epoch ms); the URL holds `from` / `to` as typed   |
| Set a variable         | `<a href="?var-env=prod">` (other parameters are kept)                          |
| Set the time range     | `<a href="?from=now-24h&to=now">` or epoch ms                                   |
| Switch tab             | `<a href="?dtab=details">` (the tab slug; nested tabs use `<prefix>-dtab`)      |
| View a panel           | `<a href="#panel-4">`                                                           |
| Edit a panel           | `<a href="?editPanel=panel-4">` (only for users who can edit the dashboard)     |
| Explore a panel        | `<a href="#explore-panel-4">`                                                   |
| Focus a panel          | `<a href="#focus-panel-4">` (scrolls to it, switching tab or expanding its row) |
| Open a dashboard       | `<a href="/d/<uid>?var-env=prod">`                                              |

What the URL does not carry:

- constant variables and variables with `skipUrlSync`;
- a variable's display text (only its value; `All` is `$__all`);
- the repeat value of a repeated panel (its queries are interpolated, so read it from the data);
- on public dashboards, variables and time left at their defaults (the URL holds only what changed).

There is no `replaceVariables` fallback: the gaps above are rare in drawing code and an
interpolation API would be one more contract to keep stable.

### Snippets

```js
// The last non-null value of a field.
function lastNotNull(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) {
      return values[i];
    }
  }
  return null;
}

// Frames grouped by their -- Dashboard -- source panel; other frames get a group of their own.
function groupBySource(series) {
  const groups = new Map();
  return series.reduce((list, frame) => {
    const id = frame.meta?.custom?.dashboardSourcePanelId;
    if (id == null) {
      list.push({ panelId: null, title: null, frames: [frame] });
    } else if (groups.has(id)) {
      groups.get(id).frames.push(frame);
    } else {
      const group = { panelId: id, title: frame.meta.custom.dashboardSourcePanelTitle ?? null, frames: [frame] };
      groups.set(id, group);
      list.push(group);
    }
    return list;
  }, []);
}

// A time in the dashboard time zone.
const formatTime = (ms, timeZone) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(ms);

// Light or dark theme, for code that draws on a canvas.
const isDark = getComputedStyle(document.documentElement).colorScheme === 'dark';
```

### CSS

The theme is available as CSS custom properties on `:root`, updated when the theme changes, and
`color-scheme` is set to the theme mode, so `light-dark()` works. There is no JavaScript theme
object.

`--gf-color-text-primary`, `--gf-color-text-secondary`, `--gf-color-text-disabled`,
`--gf-color-text-link`, `--gf-color-bg-canvas`, `--gf-color-bg-primary`, `--gf-color-bg-secondary`,
`--gf-color-border-weak`, `--gf-color-border-medium`, `--gf-color-border-strong`,
`--gf-color-primary`, `--gf-color-primary-contrast`, `--gf-color-success`, `--gf-color-warning`,
`--gf-color-error`, `--gf-color-info`, `--gf-palette-0` to `--gf-palette-N`, `--gf-font-family`,
`--gf-font-family-mono`, `--gf-font-size`, `--gf-font-size-sm`, `--gf-spacing` and `--gf-radius`.

While the image renderer captures the dashboard, `<html>` has the class `gf-render-target`, and
animations and transitions are disabled. Code that animates from JavaScript should draw the final
state when `document.documentElement.classList.contains('gf-render-target')`.

### Links

Clicks on `<a href>` are sent to Grafana, which follows only these links:

- `#panel-<id>` opens a panel of this dashboard in view mode.
- `#explore-panel-<id>` opens Explore with that panel's queries, datasource and the dashboard time
  range, like the panel menu's Explore item. Ignored without Explore access.
- `#focus-panel-<id>` scrolls to that panel, switching tab or expanding its row, and highlights it
  for two seconds.
- `?<params>` changes the state of this dashboard, keeping the other parameters.
  `editPanel=panel-<id>` opens the panel editor, only for users who can edit the dashboard;
  otherwise the whole link is ignored.
- `/d/<uid>[/<slug>][?<params>]` opens another dashboard.

Only these parameters are allowed: `viewPanel`, `editPanel` (this dashboard only, not with
`viewPanel`), `from`, `to`, `var-<name>` (values up to 512 characters) and tab keys (`dtab`,
`<prefix>-dtab`). Panel links carry only the panel id: Grafana reads the queries and time range
from the dashboard, never from the frame. A link with any other parameter, a scheme or a host is
dropped. At most one link per second is followed, and only while the page has transient user
activation (shortly after a click). Links to an element inside the frame (`#section`) scroll the
frame and never leave it.

### Not available

Network access (`fetch`, XHR, WebSocket, WebRTC, remote images and fonts), `eval` and
`new Function`, popups, forms, storage, workers, nested frames, `<object>` and `<embed>`, and inline
event attributes (`onclick="..."`; use `addEventListener`). Images and fonts must be `data:` or
`blob:` URLs. Creating or inserting an `iframe`, `frame`, `object` or `embed` element, or setting
markup that contains one, throws. `document.currentScript` is `null` while the code runs. There is
no way to query, change panel options or call a Grafana API.

### Versioning

Each panel stores the drawing API version in its options, `apiVersion`, so the version is part of
the dashboard JSON: version history, Git sync and provisioning cover it like any other option.

- New panels get the latest version (today `1`). A saved panel without one is pinned to `1`.
- The host has one serializer per supported version and builds that version's `ctx`, so a dashboard
  saved with version 1 keeps getting version 1 after Grafana upgrades.
- Within a version, changes are additive only: new `ctx` fields, new CSS variables, new link
  targets. Renaming or removing anything requires a new version.
- A panel whose version this Grafana does not support shows an error instead of drawing.
- The code can read the version as `panel.apiVersion`.

What is stable within a version: the `PanelProps`-shaped fields, the CSS variables and the link
formats. Links are the most stable part, because they are the public dashboard URL parameters that
bookmarks already rely on. While the panel is alpha the whole API may still change before version 1
is declared stable.

## Limits

| Limit                               | Value                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| Code size                           | 256 KiB (UTF-8)                                       |
| Data sent to the frame              | 4 MiB serialized, 100,000 values, 1,000 frames        |
| String value length                 | 1,024 characters, longer values are cut               |
| Elements under `#root` after a draw | 20,000                                                |
| Startup                             | 15 s from creation until the frame is ready           |
| Draw                                | 10 s per draw                                         |
| Unresponsive frame                  | 8 s without answering a heartbeat, from the first one |
| Messages from the frame             | 50 per second                                         |
| Error message length                | 4,096 characters                                      |
| Link length                         | 2,048 characters                                      |
| Height hint (content-fit layouts)   | 10,000 px                                             |
| Image rendering wait                | 30 s                                                  |
| Capture of the drawing              | 3 s, PNG data URL up to 8 MiB                         |

When the data is over a limit the panel shows a message and does not draw. Too many elements clear
the drawing and show an error. A frame that does not start, stops answering, navigates away, sends
invalid messages or too many messages is stopped: the panel removes the frame, which tears its
document down, and offers **Retry**, which starts a new frame.

## Security model

- The code runs in two nested sandboxed iframes, `sandbox="allow-scripts"` without
  `allow-same-origin`. Both documents are `srcdoc` documents with an opaque origin: they cannot
  read Grafana's DOM, cookies, storage or session.
- Each document has a Content Security Policy with `default-src 'none'` and `connect-src 'none'`,
  so the frame has no network access through fetch, XHR, WebSocket or resource loads. The outer
  document also sets `frame-src 'none'`, which stops the inner frame from navigating itself to an
  external URL to leak data.
- CSP does not govern WebRTC, so before the code runs the content frame replaces
  `RTCPeerConnection`, `webkitRTCPeerConnection`, `RTCDataChannel`, `RTCRtpSender`,
  `RTCRtpReceiver`, `RTCIceTransport`, `RTCSctpTransport` and the other WebRTC constructors with
  read-only, non-configurable stubs that throw.
- A nested frame would give the code a fresh realm with the original constructors. The content
  document sets `frame-src 'none'` and `child-src 'none'`, and the bootstrap makes `createElement`,
  `createElementNS`, every node insertion method and every markup sink (`innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `setHTMLUnsafe`, `createContextualFragment`, `document.write`) throw for
  `iframe`, `frame`, `object` and `embed`. Frame elements never expose `contentWindow` or
  `contentDocument`, and a mutation observer removes any frame element that still gets inserted.
  The guards use references captured before the code runs, so replacing globals or prototype
  methods later does not disable them.
- The code is never spliced into HTML. It is embedded as an escaped JSON string and inserted as a
  script that carries the CSP nonce. The panel never allows `unsafe-eval` or `'strict-dynamic'`.
- The nonce is Grafana's page nonce when there is one, so the code never sees it. Before the code
  runs, the bootstrap clears the nonce and the text of its own script, removes that script and the
  CSP `meta` element (the parsed policy stays in force), keeps `securitypolicyviolation` events and
  `ReportingObserver`, which carry the policy text, from the code, and runs the code's script inside
  a closed shadow root, where `document.currentScript` is `null` and no query reaches it. That
  script loses its nonce and text and leaves the document as soon as it has run.
- The frame talks to Grafana only over a versioned message channel. Grafana validates every message
  and every link. Nothing generates or changes code at view time: the panel runs the stored code as
  it is.
- Public dashboards serve the stored code and run it in the same sandbox, but every link,
  including edit, Explore and focus links, is ignored there and the panel gets no extra capability.
- Snapshots carry the panel's data frames like any other panel, and the code draws them.

## Image and PDF rendering

When the dashboard is captured by the image renderer, the panel keeps the capture waiting until the
frame reports that it finished drawing data that will not change (`Done`, `Error` or
`PartialResult`), or that drawing that data failed (an error thrown by `draw`, or too many
elements), or until the code fails to start, the frame is stopped, a draw times out, or 30 seconds
pass. Every later draw of final data, after a refresh, a variable change or a resize, holds the
capture again until that draw finishes or fails. Animations and transitions are
disabled in that mode, `<html>` has the class `gf-render-target`, and the frame waits for fonts and images before it reports completion.
Panels that are scrolled out of view pause drawing, except during image rendering.

Grafana cannot read the opaque frame, so a page capture made in the browser (rather than by the
image renderer) would show the panel empty. For those, the host can ask the frame for a PNG of its
drawing: the frame copies its document into an SVG `foreignObject`, turns canvases into images,
draws that on a canvas and returns the data URL. The host accepts only a `data:image/png` URL of at
most 8 MiB, within 3 seconds. A browser that refuses to rasterize `foreignObject` (Safari) returns
an error instead. The capture is filled with the drawing's background (or the theme's panel
background when the drawing is transparent), so it reads on its own.

## Draw status

The panel reports the result of its last draw to Grafana, so tools that cannot see into the frame
can read it with the Mutation API command `GET_PANEL_RENDER_STATUS`: `pending`, `drawn` or `error`,
whether the drawn data is final, the error kind and message, problems reported during a draw that
still finished, the draw time and the element count. The report carries a digest of the code, so a
tool that just wrote the code can wait for the report of that code. A draw of an input older than
the latest one sent is never final. With `includeImage` the command also returns the frame's
capture of its drawing, and with `includeData` the shape of the data the drawing received (frames,
fields, units and formatted last values, no other values).

A panel scrolled out of view does not draw and reports `paused: true`. A Custom panel that is not
rendered at all (an inactive tab, a collapsed row, or not reached yet by lazy loading) has no
report; the command returns it as `not-mounted` with a reason. `reveal` brings one panel into view
and `waitMs` waits for its draw. Each repeat of a repeated panel reports on its own, with its scene
key as `instanceKey`.

## Landing tab

In edit mode, a dashboard with tabs has an **Add landing tab** action next to the other tab actions
when this panel is available. It adds an Overview tab in first position with one Custom panel that
fills the tab. The panel gets one `-- Dashboard --` query (with transformations) per panel it can
reuse, in layout order and up to eight: Custom panels, panels that already read `-- Dashboard --`
and repeat clones are left out. Its code starts from a template that groups the frames by source
panel.

## Migrating from the Dynamic text panel

Changing a `marcusolsson-dynamictext-panel` panel to this panel converts simple templates: content
with plain `{{field}}` or `{{[field name]}}` placeholders, no custom helpers or `afterRender`, and
the `everyRow` or `allRows` render mode. Placeholders are filled from the first frame, once per row
for `everyRow` and from the first row for `allRows`, with HTML escaping. The panel styles are kept.
HTML in the template is kept but **Markdown is shown as plain text**.

Templates that use Handlebars blocks, partials, unescaped output, helper calls, custom helpers,
`afterRender` or another render mode get the blank template, with the original content kept in a
comment at the top.

## Known limitations

- A `-- Dashboard --` query reads one source panel. Use one query per source panel to combine
  several panels.
- A busy loop in the drawing code can stall the Grafana tab when the browser runs the opaque frame
  in the same process. The heartbeat stops the frame, but only after the loop yields.
- There is no Markdown or Handlebars rendering and no parity with the Dynamic text panel beyond
  simple field placeholders.
- The code cannot call the network, run queries or trigger actions; it can only draw and link.
- Variables that are not URL-synced are not visible to the code (see [URL state](#url-state)).

## Remaining risks

- The WebRTC and nested-frame guards are JavaScript, not a browser boundary. They cover the APIs
  listed above in current browsers; a new DOM API that creates a browsing context or a network
  channel would need a new guard. The mutation observer backstop runs after the insertion, not
  before, so it narrows but does not close such a gap.
- The CSP `webrtc 'block'` directive would enforce the WebRTC restriction in the browser, but
  Chromium does not recognize it today (it logs an unrecognized directive), so it is not set.
- DNS prefetch and preconnect hints (`<link rel="dns-prefetch">`) are not governed by CSP in every
  browser, so a drawing could leak a few bytes through DNS lookups of attacker-chosen host names.
  Both frame documents set `x-dns-prefetch-control: off`, which turns off speculative prefetch
  where the browser honors it, but does not stop explicit `preconnect` hints everywhere.
- A browser that does not run scripts inside a shadow root gets the code's script in the light
  DOM, where the code can read that script's nonce while its top level runs. The bootstrap checks
  before relying on it. Chromium runs them; Firefox and Safari should, per the HTML spec, but this
  was not verified.
- The click requirement for links is the browser's transient user activation on the Grafana page,
  which any recent click on the page grants, not only a click inside the drawing. Within that
  window the code can request any allowlisted link.
- `window.length` and `window[0]` cannot be intercepted from script. They stay empty only because
  no frame element can be inserted.
