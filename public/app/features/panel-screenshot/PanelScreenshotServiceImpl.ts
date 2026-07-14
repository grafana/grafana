import { type PanelPlugin, type PanelScreenshotContext } from '@grafana/data';
import { type PanelScreenshotOptions, type PanelScreenshotService, reportInteraction } from '@grafana/runtime';
import { isSceneObject } from '@grafana/scenes';

import { syncGetPanelPlugin } from '../plugins/importPanelPlugin';

const LOSSY_QUALITY = 0.92;

type Format = NonNullable<PanelScreenshotOptions['format']>;
type PluginSource = 'html-to-image' | 'override';
type ErrorKind = 'panel_not_in_dom' | 'html_to_image_failed' | 'override_failed' | 'unknown';

export class PanelScreenshotServiceImpl implements PanelScreenshotService {
  async capture(panelPathId: string, options: PanelScreenshotOptions = {}): Promise<Blob> {
    if (options.sceneContext !== undefined && !isValidSceneContext(options.sceneContext)) {
      throw new Error(
        `sceneContext must be a SceneObject (got ${describeValue(options.sceneContext)}). ` +
          'Pass `this` from a SceneObject method, a scene reference held by your component, ' +
          'or omit the option to fall back to window.__grafanaSceneContext.'
      );
    }

    const format: Format = options.format ?? 'png';
    const start = performance.now();

    let panelType = 'unknown';
    let plugin: PluginSource = 'html-to-image';

    try {
      const element = resolvePanelElement(panelPathId);

      const panelPlugin = resolvePanelPlugin(panelPathId, options.sceneContext);
      if (panelPlugin) {
        panelType = panelPlugin.meta.id;
      }

      if (panelPlugin?.onScreenshot) {
        const ctx: PanelScreenshotContext = { element, format };
        plugin = 'override';
        let overrideBlob: Blob | null;
        try {
          overrideBlob = await panelPlugin.onScreenshot(ctx);
        } catch (overrideErr) {
          const msg = overrideErr instanceof Error ? overrideErr.message : String(overrideErr);
          throw Object.assign(new Error(`override_failed: ${msg}`), { kind: 'override_failed' });
        }
        if (overrideBlob) {
          warnOnMimeMismatch(overrideBlob, format, panelType);
          report(panelType, start, true, undefined, plugin);
          return overrideBlob;
        }
        // Handler returned null — fall through to html-to-image.
        plugin = 'html-to-image';
      }

      const blob = await captureWithHtmlToImage(element, format);
      report(panelType, start, true, undefined, plugin);
      return blob;
    } catch (err) {
      report(panelType, start, false, classifyError(err), plugin);
      throw err;
    }
  }
}

function resolvePanelElement(panelPathId: string): HTMLElement {
  const selector = `[data-viz-panel-id="${CSS.escape(panelPathId)}"]`;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(
      `Panel not in DOM (panelPathId="${panelPathId}"). Panel may be off-screen or virtualised. Scroll the panel into view before calling capture, or use the panel-menu extension point which fires only when the panel is visible.`
    );
  }
  return element;
}

function resolvePanelPlugin(panelPathId: string, explicitSceneContext?: unknown): PanelPlugin | undefined {
  // Walk the active scene to map panelPathId -> pluginId. Explicit context
  // takes priority; falls back to the global set by the dashboard scene on
  // mount. Non-scene contexts fall through to the default html-to-image path.
  const sceneContext =
    explicitSceneContext ?? (typeof window !== 'undefined' ? window.__grafanaSceneContext : undefined);
  if (!sceneContext) {
    return undefined;
  }

  const pluginId = findPluginIdByPathId(sceneContext, panelPathId);
  if (!pluginId) {
    return undefined;
  }
  return syncGetPanelPlugin(pluginId);
}

/**
 * Validates the public-API `sceneContext` option against scenes' own type
 * guard. Adds a null/non-object guard since `isSceneObject` will throw on
 * primitive or null input. The walker downstream still operates on `unknown`;
 * this gate only exists so misuses of the public API fail fast with a clear
 * message instead of silently falling through to the html-to-image renderer.
 */
function isValidSceneContext(value: unknown): boolean {
  return typeof value === 'object' && value !== null && isSceneObject(value);
}

/**
 * Non-breaking signal for plugin authors during the @alpha period: warn when
 * a plugin's onScreenshot returns a Blob with a MIME type that doesn't match
 * the requested format. Skips the check when `Blob.type` is empty - some
 * plugin implementations legitimately return that. Strict validation (throw
 * on mismatch) is a follow-up once the @alpha tag relaxes.
 */
function warnOnMimeMismatch(blob: Blob, format: Format, panelType: string): void {
  const expected = `image/${format}`;
  const actual = blob.type;
  if (!actual || actual === expected) {
    return;
  }
  console.warn(
    `[panel-screenshot] plugin "${panelType}" returned ${actual} but ${expected} was requested. ` +
      'Update onScreenshot to honour the requested format, or return null to defer to the default renderer.'
  );
}

function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findPluginIdByPathId(root: unknown, panelPathId: string): string | undefined {
  // Walk the scene to find a VizPanel whose getPathId() matches. Calling the
  // method (vs recomputing the path id here) keeps us off the duck-typing
  // treadmill of mirroring scenes' internal path-id construction.
  const visited = new Set<unknown>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isObject(node) || visited.has(node)) {
      continue;
    }
    visited.add(node);

    const state = node.state;
    if (!isObject(state)) {
      continue;
    }
    if (typeof node.getPathId === 'function' && typeof state.pluginId === 'string') {
      try {
        if (node.getPathId() === panelPathId) {
          return state.pluginId;
        }
      } catch {
        // Partially-initialised panel; skip and keep walking.
      }
    }
    for (const value of Object.values(state)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          stack.push(item);
        }
      } else if (isObject(value)) {
        stack.push(value);
      }
    }
  }
  return undefined;
}

async function captureWithHtmlToImage(element: HTMLElement, format: Format): Promise<Blob> {
  const htmlToImage = await import(/* webpackChunkName: "html-to-image" */ 'html-to-image');

  switch (format) {
    case 'png':
      return htmlToImage.toBlob(element).then(requireBlob);
    case 'jpeg':
      return htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/jpeg' }).then(requireBlob);
    case 'webp':
      return htmlToImage.toBlob(element, { quality: LOSSY_QUALITY, type: 'image/webp' }).then(requireBlob);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported screenshot format: ${exhaustive}`);
    }
  }
}

function requireBlob(blob: Blob | null): Blob {
  if (!blob) {
    throw new Error('html-to-image returned a null Blob');
  }
  return blob;
}

function report(panelType: string, start: number, ok: boolean, errorKind: ErrorKind | undefined, plugin: PluginSource) {
  try {
    reportInteraction('grafana_panel_screenshot_captured', {
      panelType,
      durationMs: Math.round(performance.now() - start),
      ok,
      errorKind,
      plugin,
    });
  } catch {
    // Analytics failures must not bubble up or fail the capture.
  }
}

function classifyError(err: unknown): ErrorKind {
  if (err instanceof Error) {
    if (err.message.startsWith('override_failed')) {
      return 'override_failed';
    }
    if (err.message.startsWith('Panel not in DOM')) {
      return 'panel_not_in_dom';
    }
    if (err.message.includes('html-to-image')) {
      return 'html_to_image_failed';
    }
  }
  return 'unknown';
}
