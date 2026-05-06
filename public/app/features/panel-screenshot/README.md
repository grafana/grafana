# Panel Screenshot API

In-browser PNG/JPEG/WebP capture of a rendered Grafana panel. Public via `getPanelScreenshotService()` from `@grafana/runtime`.

> **Status:** `@alpha`. Surface may change before promotion.

## What it does

Given a `panelPathId` (the same id scenes emits as the `data-viz-panel-id` DOM attribute on a `VizPanel`), `capture()`:

1. Locates the panel element in the current document via `document.querySelector('[data-viz-panel-id="..."]')`.
2. Resolves the panel's plugin and, if the plugin defines `PanelPlugin.onScreenshot`, gives it first refusal.
3. Falls back to `html-to-image` if no override or if the override returns `null`.
4. Returns a `Blob` (or throws with a structured `kind` for analytics).

## Capture API

```ts
import { getPanelScreenshotService } from '@grafana/runtime';

const blob = await getPanelScreenshotService().capture(panelPathId, {
  format: 'png',           // 'png' | 'jpeg' | 'webp', default 'png'
  sceneContext: this,      // optional; SceneObject. Falls back to window.__grafanaSceneContext.
});
```

The panel must be **mounted in the DOM at the call site**. Off-screen, virtualised, or different-tab panels throw `Panel not in DOM`.

## Usage patterns

### 1. Plugin extension (panel-menu link)

The most common path. The plugin extension framework supplies `panelPathId` in the click handler context.

```ts
import { AppPlugin, PluginExtensionPoints, type PluginExtensionPanelContext } from '@grafana/data';
import { getPanelScreenshotService } from '@grafana/runtime';

export const plugin = new AppPlugin().addLink<PluginExtensionPanelContext>({
  title: 'Send to Slack',
  targets: [PluginExtensionPoints.DashboardPanelMenu],
  onClick: async (_event, helpers) => {
    const ctx = helpers.context;
    if (!ctx) return;
    const blob = await getPanelScreenshotService().capture(ctx.panelPathId, { format: 'png' });
    uploadToSlack(blob);
  },
});
```

`sceneContext` isn't required here: the user is on a dashboard route, so `window.__grafanaSceneContext` is set and the override-resolver picks it up automatically.

### 2. Direct call from a `SceneObject`

When you have a scene reference (e.g. inside a custom `SceneObject` method), pass it explicitly. This works for non-`DashboardScene` roots too — embedded panels, drill-downs, custom scene apps.

```ts
import { SceneObjectBase } from '@grafana/scenes';
import { getPanelScreenshotService } from '@grafana/runtime';

class ExportButton extends SceneObjectBase<MyState> {
  async exportPanel(panel: VizPanel): Promise<void> {
    const blob = await getPanelScreenshotService().capture(panel.getPathId(), {
      sceneContext: this,
      format: 'jpeg',
    });
    download(blob, 'panel.jpg');
  }
}
```

### 3. From a React component holding a scene reference

```tsx
function ExportButton({ scene, panelPathId }: { scene: SceneObject; panelPathId: string }) {
  const onClick = async () => {
    const blob = await getPanelScreenshotService().capture(panelPathId, { sceneContext: scene });
    download(blob, 'panel.png');
  };
  return <Button onClick={onClick}>Export</Button>;
}
```

### 4. Plugin opt-in to override the renderer

Set `onScreenshot` on a `PanelPlugin` to return a custom Blob (e.g. a higher-fidelity Canvas/WebGL capture, server-side render). Return `null` to defer to the default `html-to-image` path.

```ts
import { PanelPlugin } from '@grafana/data';

export const plugin = new PanelPlugin(MyPanel).setMigrationHandler(...).useFieldConfig({...});

plugin.onScreenshot = async ({ element, format }) => {
  const canvas = element.querySelector('canvas');
  if (!canvas) return null;                 // fall through to html-to-image
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), `image/${format}`);
  });
};
```

A throw from `onScreenshot` is reported as `errorKind: 'override_failed'` in analytics; a `null` return falls through cleanly.

## Errors

| Thrown when | `errorKind` |
|---|---|
| Selector finds no element | `panel_not_in_dom` |
| `onScreenshot` throws | `override_failed` |
| `html-to-image` throws or returns null | `html_to_image_failed` |
| Anything else | `unknown` |

`sceneContext` validation throws synchronously before any DOM work if the value is non-`SceneObject`-shaped — fail-fast, no silent fallback.

## How `panelPathId` is generated

`VizPanel.getPathId()` (from `@grafana/scenes`) returns `panel-<legacyId>` prefixed with the chain of `LocalValueVariable` values from the panel up to the root. For repeats, this disambiguates instances:

| Scene shape | `panelPathId` |
|---|---|
| One panel, no repeats | `panel-3` |
| Panel inside a row repeated by `$server = web-1` | `web-1$panel-3` |
| Panel in a column-repeat inside a row-repeat | `prod$us-east$panel-3` |

The same string is mirrored to the rendered DOM via `data-viz-panel-id`. Plugin authors get it pre-computed via `PluginExtensionPanelContext.panelPathId`.

## Telemetry

Every call emits `grafana_panel_screenshot_captured` with `panelType`, `durationMs`, `ok`, `errorKind`, and `plugin` (`'html-to-image'` or `'override'`) so failure modes are observable in production.
