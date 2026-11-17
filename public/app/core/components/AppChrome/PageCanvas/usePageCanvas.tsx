import { type ReactNode, useCallback, useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';

import { type PageCanvasModel, type PageCanvasProps, parsePageCanvasModel } from './types';

export interface PageCanvasState {
  /** The canvas to show above the page, or `null` when there is none. */
  canvas: PageCanvasModel | null;
  /** The plugin's component, which core keeps mounted in the canvas pane whether or not a canvas shows. */
  pane: ReactNode;
}

/**
 * The page canvas a plugin fills through `grafana/page-canvas/v0-alpha`. Only the Assistant can, with one component
 * that both decides the canvas and renders its pane tabs' content.
 */
export function usePageCanvas(enabled: boolean): PageCanvasState {
  const [model, setModel] = useState<PageCanvasModel | null>(null);
  const setCanvas = useCallback<PageCanvasProps['setCanvas']>(
    (value: unknown) => setModel(parsePageCanvasModel(value)),
    []
  );
  const { components } = usePluginComponents<PageCanvasProps>({
    extensionPointId: PluginExtensionPoints.PageCanvas,
  });
  const pane = enabled
    ? renderLimitedComponents({ props: { setCanvas }, components, limit: 1, pluginId: ASSISTANT_PLUGIN_ID })
    : null;
  return { canvas: pane ? model : null, pane };
}
