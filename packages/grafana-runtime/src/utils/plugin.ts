import 'systemjs/dist/system';
// Add ability to load plugins bundled as AMD format
import 'systemjs/dist/extras/amd';
// Add ability to load plugins bundled as CJS format
import 'systemjs-cjs-extra';

import { PanelPlugin } from '@grafana/data';

import { config } from '../config';

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
export const SystemJS = window.System;

/**
 * Use this to load css for a Grafana plugin by specifying a {@link PluginCssOptions}
 * containing styling for the dark and the light theme.
 *
 * @param options - plugin styling for light and dark theme.
 * @public
 */
export async function loadPluginCss(options: PluginCssOptions): Promise<any> {
  try {
    const cssPath = config.bootData.user.theme === 'light' ? options.light : options.dark;
    return await SystemJS.import(cssPath);
  } catch (err) {
    console.error(err);
  }
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

// Grafana relies on RequireJS for Monaco Editor to load.
// The SystemJS AMD extra creates a global define which causes RequireJS to silently bail.
// Here we move and reset global define so Monaco Editor loader script continues to work.
// @ts-ignore
window.__grafana_amd_define = window.define;
// @ts-ignore
window.define = undefined;
