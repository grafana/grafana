import 'systemjs/dist/system';
// Add ability to load plugins bundled as AMD format)
import 'systemjs/dist/extras/amd';
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
export function loadPluginCss(options: PluginCssOptions): Promise<any> {
  const cssPath = config.bootData.user.theme === 'light' ? options.light : options.dark;
  return SystemJS.import(cssPath);
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

// TODO: Clean this up. Should we export the namespace?
// The AMD extra creates a global define which RequireJS will silently bail on.
// Grafana currently relies on requirejs for Monaco Editor so we move it
// elsewhere otherwise monaco will fail to load.
// @ts-ignore
window.systemDefine = window.define;

// @ts-ignore
window.define = undefined;
