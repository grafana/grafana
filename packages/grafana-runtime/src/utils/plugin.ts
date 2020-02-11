import { config } from '../config';

// @ts-ignore
import System from 'systemjs/dist/system.js';

export interface PluginCssOptions {
  light: string;
  dark: string;
}

export const SystemJS = System;

export function loadPluginCss(options: PluginCssOptions): Promise<any> {
  const theme = config.bootData.user.lightTheme ? options.light : options.dark;
  return SystemJS.import(`${theme}!css`);
}
