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

### Not available

Network access (`fetch`, XHR, WebSocket, remote images and fonts), `eval` and `new Function`,
popups, forms, storage, workers, nested frames and inline event attributes (`onclick="..."`; use
`addEventListener`). Images and fonts must be `data:` or `blob:` URLs.

## Limits

| Limit                               | Value                                          |
| ----------------------------------- | ---------------------------------------------- |
| Code size                           | 256 KiB (UTF-8)                                |
| Data sent to the frame              | 4 MiB serialized, 100,000 values, 1,000 frames |
| String value length                 | 1,024 characters, longer values are cut        |
| Variables                           | 100 variables, 1,000 values each               |
| Elements under `#root` after a draw | 20,000                                         |
| Startup                             | 15 s from load until the frame is ready        |
| Draw                                | 10 s per draw                                  |
| Unresponsive frame                  | 8 s without answering a heartbeat              |
| Messages from the frame             | 50 per second                                  |
| Error message length                | 4,096 characters                               |
| Link length                         | 2,048 characters                               |
| Height hint (content-fit layouts)   | 10,000 px                                      |
| Image rendering wait                | 30 s                                           |

When the data is over a limit the panel shows a message and does not draw. Too many elements clear
the drawing and show an error. A frame that does not start, stops answering, navigates away, sends
invalid messages or too many messages is stopped; the panel then offers **Reload**.

## Security model

- The code runs in two nested sandboxed iframes, `sandbox="allow-scripts"` without
  `allow-same-origin`. Both documents are `srcdoc` documents with an opaque origin: they cannot
  read Grafana's DOM, cookies, storage or session.
- Each document has a Content Security Policy with `default-src 'none'` and `connect-src 'none'`,
  so the frame has no network access. The outer document also sets `frame-src 'none'`, which stops
  the inner frame from navigating itself to an external URL to leak data.
- The code is never spliced into HTML. It is embedded as an escaped JSON string and inserted as a
  script that carries the CSP nonce. The panel never allows `unsafe-eval`.
- The frame talks to Grafana only over a versioned message channel. Grafana validates every message
  and every link. There is no model at view time: the panel runs the stored code as it is.
- Public dashboards serve the stored code and run it in the same sandbox, but links are ignored
  there and the panel gets no extra capability.
- Snapshots carry the panel's data frames like any other panel, and the code draws them.

## Image and PDF rendering

When the dashboard is captured by the image renderer, the panel keeps the capture waiting until the
frame reports that it finished drawing data that will not change (`Done`, `Error` or
`PartialResult`), or until an error, a draw timeout, or 30 seconds. Animations and transitions are
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
