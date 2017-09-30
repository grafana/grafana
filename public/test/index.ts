// const context = require.context('./', true, /_specs\.ts/);
// context.keys().forEach(context);
// module.exports = context;

import 'babel-polyfill';
import 'jquery';
import angular from 'angular';
import 'angular-mocks';
import 'app/app';

angular.module('grafana', ['ngRoute']);
angular.module('grafana.services', ['ngRoute', '$strap.directives']);
angular.module('grafana.panels', []);
angular.module('grafana.controllers', []);
angular.module('grafana.directives', []);
angular.module('grafana.filters', []);
angular.module('grafana.routes', ['ngRoute']);

declare var require: any;
const context = require.context('../', true, /specs/);

for (let key of context.keys()) {
  context(key);
}




