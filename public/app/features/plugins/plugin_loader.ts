import System from 'systemjs/dist/system.js';
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment';
import angular from 'angular';
import jquery from 'jquery';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';
import appEvents from 'app/core/app_events';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';
import * as datemath from 'app/core/utils/datemath';
import builtInPlugins from './buit_in_plugins';

System.config({
  baseURL: 'public',
  defaultExtension: 'js',
  packages: {
    'plugins': {
      defaultExtension: 'js'
    }
  },
  map: {
    text: 'vendor/plugin-text/text.js',
    css: 'vendor/plugin-css/css.js'
  },
});

// add cache busting
var systemLocate = System.locate;
System.cacheBust = '?bust=' + Date.now();
System.locate = function(load) {
  var System = this;
  return Promise.resolve(systemLocate.call(this, load)).then(function(address) {
    return address + System.cacheBust;
  });
};

function exposeToPlugin(name: string, component: any) {
  System.registerDynamic(name, [], true, function(require, exports, module) {
    module.exports = component;
  });
}

exposeToPlugin('lodash', _);
exposeToPlugin('moment', moment);
exposeToPlugin('jquery', jquery);
exposeToPlugin('angular', angular);
exposeToPlugin('rxjs/Subject', Subject);
exposeToPlugin('rxjs/Observable', Observable);

exposeToPlugin('app/plugins/sdk', sdk);
exposeToPlugin('app/core/utils/datemath', datemath);
exposeToPlugin('app/core/utils/kbn', kbn);
exposeToPlugin('app/core/config', config);
exposeToPlugin('app/core/time_series', TimeSeries);
exposeToPlugin('app/core/time_series2', TimeSeries);
exposeToPlugin('app/core/table_model', TableModel);
exposeToPlugin('app/core/app_events', appEvents);

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
  exposeToPlugin(flotDep, {fakeDep: 1});
}

export function importPluginModule(path: string): Promise<any> {
  let builtIn = builtInPlugins[path];
  if (builtIn) {
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

