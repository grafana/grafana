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
 * Use this to load css for a Grafana plugin by specifying a {@link PluginCssOptions}
 * containing styling for the dark and the light theme.
 *
 * @param options - plugin styling for light and dark theme.
 * @public
 */
export async function loadPluginCss(options: PluginCssOptions): Promise<System.Module | void> {
  try {
    const cssPath = config.bootData.user.theme === 'light' ? options.light : options.dark;
    return window.System.import(cssPath);
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
