# Render panel

The render panel draws panel data with JavaScript stored in the panel options (`options.code`).
Data comes from the panel's normal queries, including the `-- Dashboard --` datasource that reuses
the results of other panels. The code only draws: it cannot query, fetch or call any Grafana API.

Because the code lives in the dashboard JSON it is diffable and reviewable like any other panel
option. The panel adds no schema: it is a regular panel with type `render` and an opaque options
object, so it survives dashboard schema v2 to v1 to v2 conversion unchanged.

The panel is in **alpha**. It is only listed when alpha panels are enabled:

```ini
[plugins]
enable_alpha = true
```

## Writing drawing code

The code runs once when the frame starts. It must call `panel.onRender(draw)` at the top level. The
frame calls `draw(ctx)` for every change of data, time range, variables, theme or size. `draw` may
return a promise; the frame waits for it before it reports the draw as complete.

```js
panel.onRender(({ root, data, helpers }) => {
  const { escapeHtml, frames, field, last } = helpers;
  root.innerHTML = frames()
    .map((frame) => {
      const value = field(frame, 'number');
      return (
        '<p>' + escapeHtml(frame.name ?? frame.refId) + ': ' + escapeHtml(value?.lastDisplay ?? last(value)) + '</p>'
      );
    })
    .join('');
});
```

The editor's **Insert template** menu has three starting points: a KPI briefing (one card per
source panel with a sparkline and the change over the range), an incident layout (switches to an
incident view when a metric crosses its last threshold, or when the `incident_mode` variable is
`on`), and a blank template.

### `ctx`

| Field            | Description                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `root`           | `<div id="root">`. It is kept between draws; `draw` owns its content.                                             |
| `seq`            | Increasing number of the draw.                                                                                    |
| `data`           | `{ state, series, errors }`. `state` is `NotStarted`, `Loading`, `Streaming`, `Done`, `Error` or `PartialResult`. |
| `timeRange`      | `{ from, to, raw: { from, to } }`, with `from` and `to` in epoch milliseconds.                                    |
| `timeZone`       | Resolved IANA time zone (never `browser`).                                                                        |
| `variables`      | `{ [name]: { value, text } }`, the resolved dashboard variables. Multi-value variables hold arrays.               |
| `theme`          | Snapshot of the Grafana theme: `mode`, `colors`, `palette`, `typography`, `spacingGridSize`, `borderRadius`.      |
| `size`           | `{ width, height }` of the panel in pixels.                                                                       |
| `isRenderTarget` | `true` while the image renderer captures the dashboard. Animations are disabled.                                  |
| `helpers`        | See below.                                                                                                        |

Each frame in `data.series` is `{ refId, name, length, source, fields }`. `source` is
`{ panelId, title }` when the frame came from another panel through `-- Dashboard --`. Each field is
`{ name, displayName, type, unit, labels, values, lastDisplay, lastColor, thresholds }`. Time values
are epoch milliseconds, `NaN` and `Infinity` become `null`, and objects become JSON strings.
`lastDisplay` and `lastColor` are the last non-null value formatted and colored with the field
config, as other panels show it. `thresholds` are the absolute steps with resolved colors.

### `ctx.helpers`

| Helper                     | Description                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `escapeHtml(value)`        | Escapes a value for HTML. Use it for every value placed in `innerHTML`.                                                       |
| `frames()`                 | All frames.                                                                                                                   |
| `bySource()`               | Frames grouped by source panel: `[{ panelId, title, frames }]`. Frames without a source share the group with `panelId: null`. |
| `field(frame, nameOrType)` | A field by name or display name, or else the first field of a type (`number`, `time`, `string`).                              |
| `last(field)`              | The last non-null value of a field.                                                                                           |
| `formatTime(ms, options?)` | Formats a time with `Intl.DateTimeFormat` in `ctx.timeZone`.                                                                  |

### CSS variables

The theme is also available as CSS custom properties on `:root`, updated when the theme changes:
`--gf-color-text-primary`, `--gf-color-text-secondary`, `--gf-color-text-link`,
`--gf-color-bg-canvas`, `--gf-color-bg-primary`, `--gf-color-bg-secondary`,
`--gf-color-border-weak`, `--gf-color-border-medium`, `--gf-color-primary`, `--gf-color-success`,
`--gf-color-warning`, `--gf-color-error`, `--gf-color-info`, `--gf-palette-0` to `--gf-palette-N`,
`--gf-font-family`, `--gf-font-family-mono`, `--gf-font-size`, `--gf-spacing` and `--gf-radius`.

### Links

Clicks on `<a href>` are sent to Grafana, which follows only these links:

- `#panel-<id>` opens a panel of this dashboard in view mode.
- `?<params>` changes the state of this dashboard.
- `/d/<uid>[/<slug>][?<params>]` opens another dashboard.

Only these parameters are allowed: `viewPanel`, `from`, `to`, `var-<name>` and tab keys (`dtab`,
`<prefix>-dtab`). A link with any other parameter, a scheme or a host is dropped. At most one link
per second is followed, and only right after a user click. Links to an element inside the frame
(`#section`) scroll the frame and never leave it.

`document.currentScript` is `null` while the code runs.

### Not available

Network access (`fetch`, XHR, WebSocket, WebRTC, remote images and fonts), `eval` and
`new Function`, popups, forms, storage, workers, nested frames, `<object>` and `<embed>`, and inline
event attributes (`onclick="..."`; use `addEventListener`). Images and fonts must be `data:` or
`blob:` URLs. Creating or inserting an `iframe`, `frame`, `object` or `embed` element, or setting
markup that contains one, throws.

## Limits

| Limit                               | Value                                                 |
| ----------------------------------- | ----------------------------------------------------- |
| Code size                           | 256 KiB (UTF-8)                                       |
| Data sent to the frame              | 4 MiB serialized, 100,000 values, 1,000 frames        |
| String value length                 | 1,024 characters, longer values are cut               |
| Variables                           | 100 variables, 1,000 values each                      |
| Elements under `#root` after a draw | 20,000                                                |
| Startup                             | 15 s from creation until the frame is ready           |
| Draw                                | 10 s per draw                                         |
| Unresponsive frame                  | 8 s without answering a heartbeat, from the first one |
| Messages from the frame             | 50 per second                                         |
| Error message length                | 4,096 characters                                      |
| Link length                         | 2,048 characters                                      |
| Height hint (content-fit layouts)   | 10,000 px                                             |
| Image rendering wait                | 30 s                                                  |

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
  and every link. There is no model at view time: the panel runs the stored code as it is.
- Public dashboards serve the stored code and run it in the same sandbox, but links are ignored
  there and the panel gets no extra capability.
- Snapshots carry the panel's data frames like any other panel, and the code draws them.

## Image and PDF rendering

When the dashboard is captured by the image renderer, the panel keeps the capture waiting until the
frame reports that it finished drawing data that will not change (`Done`, `Error` or
`PartialResult`), or that drawing that data failed (an error thrown by `draw`, or too many
elements), or until the code fails to start, the frame is stopped, a draw times out, or 30 seconds
pass. Every later draw of final data, after a refresh, a variable change or a resize, holds the
capture again until that draw finishes or fails. Animations and transitions are
disabled in that mode, and the frame waits for fonts and images before it reports completion.
Panels that are scrolled out of view pause drawing, except during image rendering.

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

## Remaining risks

- The WebRTC and nested-frame guards are JavaScript, not a browser boundary. They cover the APIs
  listed above in current browsers; a new DOM API that creates a browsing context or a network
  channel would need a new guard. The mutation observer backstop runs after the insertion, not
  before, so it narrows but does not close such a gap.
- The CSP `webrtc 'block'` directive would enforce the WebRTC restriction in the browser, but
  Chromium does not recognize it today (it logs an unrecognized directive), so it is not set.
- DNS prefetch and preconnect hints (`<link rel="dns-prefetch">`) are not governed by CSP in every
  browser, so a drawing could leak a few bytes through DNS lookups of attacker-chosen host names.
- A browser that does not run scripts inside a shadow root gets the code's script in the light
  DOM, where the code can read that script's nonce while its top level runs. The bootstrap checks
  before relying on it. Chromium runs them; Firefox and Safari should, per the HTML spec, but this
  was not verified.
- `window.length` and `window[0]` cannot be intercepted from script. They stay empty only because
  no frame element can be inserted.
