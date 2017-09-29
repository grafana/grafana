import System from 'systemjs/dist/system.src.js';
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment';
import angular from 'angular';
import jquery from 'jquery';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';

console.log('loading graphite');
import * as graphitePlugin from 'app/plugins/datasource/graphite/module';

// import textPanel from './panel/text/module';
// import graphPanel from './panel/graph/module';

let builtInPlugins = {
  "app/plugins/datasource/graphite/module": graphitePlugin
};

System.config({
  baseURL: 'public',
  defaultExtension: 'js',
  packages: {
    // 'app/plugins': {
    //   defaultExtension: 'js'
    // },
    'plugins': {
      defaultExtension: 'js'
    }
  },
  map: {
    text: 'vendor/plugin-text/text.js',
    css: 'vendor/plugin-css/css.js'
  },
});

System.registerDynamic('lodash', [], true, function(require, exports, module) { module.exports = _; });
System.registerDynamic('moment', [], true, function(require, exports, module) { module.exports = moment; });
System.registerDynamic('jquery', [], true, function(require, exports, module) { module.exports = jquery; });
System.registerDynamic('angular', [], true, function(require, exports, module) { module.exports = angular; });
System.registerDynamic('app/plugins/sdk', [], true, function(require, exports, module) { module.exports = sdk; });
System.registerDynamic('app/core/utils/kbn', [], true, function(require, exports, module) { module.exports = kbn; });
System.registerDynamic('app/core/config', [], true, function(require, exports, module) { module.exports = config; });
System.registerDynamic('app/core/time_series', [], true, function(require, exports, module) { module.exports = TimeSeries; });
System.registerDynamic('app/core/time_series2', [], true, function(require, exports, module) { module.exports = TimeSeries; });

import 'vendor/flot/jquery.flot';
import 'vendor/flot/jquery.flot.selection';
import 'vendor/flot/jquery.flot.time';
import 'vendor/flot/jquery.flot.stack';
import 'vendor/flot/jquery.flot.pie';
import 'vendor/flot/jquery.flot.stackpercent';
import 'vendor/flot/jquery.flot.fillbelow';
import 'vendor/flot/jquery.flot.crosshair';
import 'vendor/flot/jquery.flot.dashes';

for (let flotDep of ['jquery.flot', 'jquery.flot.pie', 'jquery.flot.time']) {
  System.registerDynamic(flotDep, [], true, function(require, exports, module) { module.exports = {fakeDep: 1}; });
}

export function importPluginModule(path: string): Promise<any> {
  let builtIn = builtInPlugins[path];
  if (builtIn) {
    console.log('builtIn', builtIn);
    return Promise.resolve(builtIn);
  }
  return System.import(path);
}

export function loadPluginCss(options) {
  if (config.bootData.user.lightTheme) {
    System.import(options.light + '!css');
  } else {
    System.import(options.dark + '!css');
  }
}

