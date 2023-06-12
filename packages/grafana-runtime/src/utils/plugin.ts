// @ts-ignore
import System from 'systemjs/dist/system.js';

import { PanelPlugin } from '@grafana/data';

import { config } from '../config';

// @ts-ignore

/**
 * Option to specify a plugin css that should be applied for the dark
 * and the light theme.
 *
 * @public
 */
export interface PluginCssOptions {
  light: string;
  dark: string;
}

/**
 * @internal
 */
export const SystemJS = System;

/**
 * Use this to load css for a Grafana plugin by specifying a {@link PluginCssOptions}
 * containing styling for the dark and the light theme.
 *
 * @param options - plugin styling for light and dark theme.
 * @public
 */
export function loadPluginCss(options: PluginCssOptions): Promise<any> {
  const theme = config.bootData.user.lightTheme ? options.light : options.dark;
  return SystemJS.import(`${theme}!css`);
}

interface PluginImportUtils {
  importPanelPlugin: (id: string) => Promise<PanelPlugin>;
  getPanelPluginFromCache: (id: string) => PanelPlugin | undefined;
}

let pluginImportUtils: PluginImportUtils | undefined;

export function setPluginImportUtils(utils: PluginImportUtils) {
  if (pluginImportUtils) {
    throw new Error('pluginImportUtils should only be set once, when Grafana is starting.');
  }

  pluginImportUtils = utils;
}

export function getPluginImportUtils(): PluginImportUtils {
  if (!pluginImportUtils) {
    throw new Error('pluginImportUtils can only be used after Grafana instance has started.');
  }

  return pluginImportUtils;
}
