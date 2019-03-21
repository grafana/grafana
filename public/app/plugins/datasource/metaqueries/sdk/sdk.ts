import { QueryCtrl } from './query_ctrl';

import config from 'app/core/config';

export function loadPluginCss(options) {
  if (config.bootData.user.lightTheme) {
    System.import(options.light + '!css');
  } else {
    System.import(options.dark + '!css');
  }
}

export { QueryCtrl };
