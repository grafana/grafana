import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { ASSISTANT_PLUGIN_ID } from 'app/core/constants';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

import { Branding } from '../../Branding/Branding';
import { getPageTitleParts } from '../../Page/usePageTitle';
import { type AppChromeState, getPageTitle } from '../AppChromeService';

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
export function usePageCanvas(enabled: boolean, chromeState: AppChromeState): PageCanvasState {
  const [model, setModel] = useState<PageCanvasModel | null>(null);
  const setCanvas = useCallback<PageCanvasProps['setCanvas']>(
    (value: unknown) => setModel(parsePageCanvasModel(value)),
    []
  );
  const title = usePageTitleForCanvas(chromeState);
  const props = useMemo<PageCanvasProps>(
    () => (title ? { setCanvas, page: { title } } : { setCanvas }),
    [setCanvas, title]
  );
  const { components } = usePluginComponents<PageCanvasProps>({
    extensionPointId: PluginExtensionPoints.PageCanvas,
  });
  const pane = enabled ? renderLimitedComponents({ props, components, limit: 1, pluginId: ASSISTANT_PLUGIN_ID }) : null;
  return { canvas: pane ? model : null, pane };
}

/**
 * The first part of the browser tab's title, from the same navigation, so the plugin can label the page's tab
 * without waiting for `document.title`. Undefined until the page sets its navigation, and never the bare app title.
 */
function usePageTitleForCanvas(chromeState: AppChromeState): string | undefined {
  const homeNav = useSelector((state) => state.navIndex)?.[HOME_NAV_ID];
  if (getPageTitle(chromeState) === undefined) {
    return undefined;
  }
  const [title] = getPageTitleParts(chromeState.sectionNav, chromeState.pageNav, homeNav);
  return title !== Branding.AppTitle ? title : undefined;
}
