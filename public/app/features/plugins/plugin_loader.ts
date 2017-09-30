import System from 'systemjs/dist/system.js';
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment';
import angular from 'angular';
import jquery from 'jquery';
import config from 'app/core/config';
import TimeSeries from 'app/core/time_series2';

import * as graphitePlugin from 'app/plugins/datasource/graphite/module';
import * as cloudwatchPlugin from 'app/plugins/datasource/cloudwatch/module';
import * as elasticsearchPlugin from 'app/plugins/datasource/elasticsearch/module';
import * as opentsdbPlugin from 'app/plugins/datasource/opentsdb/module';
import * as grafanaPlugin from 'app/plugins/datasource/grafana/module';
import * as influxdbPlugin from 'app/plugins/datasource/influxdb/module';
import * as mixedPlugin from 'app/plugins/datasource/mixed/module';
import * as mysqlPlugin from 'app/plugins/datasource/mysql/module';
import * as prometheusPlugin from 'app/plugins/datasource/prometheus/module';

import * as textPanel from 'app/plugins/panel/text/module';
import * as graphPanel from 'app/plugins/panel/graph/module';
import * as dashListPanel from 'app/plugins/panel/dashlist/module';
import * as pluginsListPanel from 'app/plugins/panel/pluginlist/module';
import * as alertListPanel from 'app/plugins/panel/alertlist/module';
import * as heatmapPanel from 'app/plugins/panel/heatmap/module';
import * as tablePanel from 'app/plugins/panel/table/module';
import * as singlestatPanel from 'app/plugins/panel/singlestat/module';
import * as gettingStartedPanel from 'app/plugins/panel/gettingstarted/module';

let builtInPlugins = {
  "app/plugins/datasource/graphite/module": graphitePlugin,
  "app/plugins/datasource/cloudwatch/module": cloudwatchPlugin,
  "app/plugins/datasource/elasticsearch/module": elasticsearchPlugin,
  "app/plugins/datasource/opentsdb/module": opentsdbPlugin,
  "app/plugins/datasource/grafana/module": grafanaPlugin,
  "app/plugins/datasource/influxdb/module": influxdbPlugin,
  "app/plugins/datasource/mixed/module": mixedPlugin,
  "app/plugins/datasource/mysql/module": mysqlPlugin,
  "app/plugins/datasource/prometheus/module": prometheusPlugin,

  "app/plugins/panel/text/module": textPanel,
  "app/plugins/panel/graph/module": graphPanel,
  "app/plugins/panel/dashlist/module": dashListPanel,
  "app/plugins/panel/pluginlist/module": pluginsListPanel,
  "app/plugins/panel/alertlist/module": alertListPanel,
  "app/plugins/panel/heatmap/module": heatmapPanel,
  "app/plugins/panel/table/module": tablePanel,
  "app/plugins/panel/singlestat/module": singlestatPanel,
  "app/plugins/panel/gettingstarted/module": gettingStartedPanel,
};

System.config({
  baseURL: 'public',
  defaultExtension: 'js',
  packages: {
    "app/plugins": {
      defaultExtension: 'js'
    },
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

