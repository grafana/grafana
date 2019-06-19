import { config } from '../config';

/* tslint:disable:import-blacklist */
import System from 'systemjs';

export interface PluginCssOptions {
  light: string;
  dark: string;
}

export function loadPluginCss(options: PluginCssOptions) {
  if (config.bootData.user.lightTheme) {
    System.import(options.light + '!css');
  } else {
    System.import(options.dark + '!css');
  }
}
