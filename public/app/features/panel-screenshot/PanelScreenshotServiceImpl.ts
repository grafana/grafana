import { type PanelPlugin, type PanelScreenshotContext } from '@grafana/data';
import { type PanelScreenshotOptions, type PanelScreenshotService, reportInteraction } from '@grafana/runtime';

import { syncGetPanelPlugin } from '../plugins/importPanelPlugin';

const LOSSY_QUALITY = 0.92;

type Format = NonNullable<PanelScreenshotOptions['format']>;
type PluginSource = 'html-to-image' | 'override';
type ErrorKind = 'panel_not_in_dom' | 'html_to_image_failed' | 'unknown';

export class PanelScreenshotServiceImpl implements PanelScreenshotService {
  async capture(panelKey: string, options: PanelScreenshotOptions = {}): Promise<Blob> {
    const format: Format = options.format ?? 'png';
    const start = performance.now();

    let panelType = 'unknown';
    let plugin: PluginSource = 'html-to-image';

    try {
      const element = resolvePanelElement(panelKey);

      const panelPlugin = resolvePanelPlugin(panelKey);
      if (panelPlugin) {
        panelType = panelPlugin.meta.id;
      }

      if (panelPlugin?.onScreenshot) {
        const ctx: PanelScreenshotContext = { element, format };
        const overrideBlob = await panelPlugin.onScreenshot(ctx);
        if (overrideBlob) {
          plugin = 'override';
          report(panelType, start, true, undefined, plugin);
          return overrideBlob;
        }
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

function resolvePanelElement(panelKey: string): HTMLElement {
  const selector = `[data-viz-panel-key="${CSS.escape(panelKey)}"]`;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(
      `Panel not in DOM (panelKey="${panelKey}"). Panel may be off-screen or virtualised. Scroll the panel into view before calling capture, or use the panel-menu extension point which fires only when the panel is visible.`
    );
  }
  return element;
}

function resolvePanelPlugin(panelKey: string): PanelPlugin | undefined {
  // The active scene is the only DOM-agnostic way to resolve panelKey -> pluginId
  // without baking a registry into VizPanel itself. When the user is in a scene-based
  // dashboard, the global context is set; otherwise (legacy panels, embedded contexts)
  // we fall through to the default html-to-image path.
  const sceneContext = typeof window !== 'undefined' ? window.__grafanaSceneContext : undefined;
  if (!sceneContext) {
    return undefined;
  }

  const pluginId = findPluginIdByKey(sceneContext, panelKey);
  if (!pluginId) {
    return undefined;
  }
  return syncGetPanelPlugin(pluginId);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findPluginIdByKey(root: unknown, panelKey: string): string | undefined {
  // Lightweight tree walk over the active scene to find a VizPanel-like node whose
  // state.key matches panelKey. Avoid importing @grafana/scenes here to keep the
  // module cheap; rely on the duck-typed state shape (key + pluginId).
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
    if (state.key === panelKey && typeof state.pluginId === 'string') {
      return state.pluginId;
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
    if (err.message.startsWith('Panel not in DOM')) {
      return 'panel_not_in_dom';
    }
    if (err.message.includes('html-to-image')) {
      return 'html_to_image_failed';
    }
  }
  return 'unknown';
}
