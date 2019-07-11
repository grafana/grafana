import { config } from '../config';

// @ts-ignore
import System from 'systemjs/dist/system.js';

export interface PluginCssOptions {
  light: string;
  dark: string;
}

export const SystemJS = System;

export function loadPluginCss(options: PluginCssOptions) {
  if (config.bootData.user.lightTheme) {
    SystemJS.import(`${options.light}!css`);
  } else {
    SystemJS.import(`${options.dark}!css`);
  }
}
