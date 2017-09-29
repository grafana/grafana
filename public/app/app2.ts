import 'babel-polyfill';

import angular from 'angular';
import {HelpCtrl} from './core/components/help/help';
import System from 'systemjs/dist/system.src.js';
import _ from 'lodash';
import * as sdk from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import moment from 'moment';

console.log(System);
console.log(HelpCtrl);
console.log(angular);

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
    css: 'app/core/utils/css_loader.js'
  },
});

console.log(System);

System.registerDynamic('lodash', [], true, function(require, exports, module) {
  module.exports = _;
});

System.registerDynamic('kbn', [], true, function(require, exports, module) {
  module.exports = kbn;
});

System.registerDynamic('moment', [], true, function(require, exports, module) {
  module.exports = moment;
});

System.registerDynamic('app/plugins/sdk', [], true, function(require, exports, module) {
  module.exports = sdk;
});

let path = 'plugins/grafana-simple-json-datasource/module';
System.import(path).then(res => {
  console.log('result', res);
});

