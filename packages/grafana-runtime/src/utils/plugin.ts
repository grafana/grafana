import { config } from '../config';

// @ts-ignore
import System from 'systemjs/dist/system.js';

export interface PluginCssOptions {
  light: string;
  dark: string;
}

export const SystemJS = System;

export function loadPluginCss(options: PluginCssOptions): Promise<any> {
  const path = config.bootData.user.lightTheme ? `${options.light}!css` : `${options.dark}!css`;

  return SystemJS.import(path);
}
