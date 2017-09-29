// const context = require.context('./', true, /_specs\.ts/);
// context.keys().forEach(context);
// module.exports = context;

// import angular from 'angular';
// import 'angular-mocks';
// import './specs/test_specs';
// import 'app/app';
//
// declare var window: any;
// declare var require: any;
// declare var module: any;
//
// window.grafanaBootData = {settings: {}};
//
// angular.module('grafana', ['ngRoute']);
// angular.module('grafana.services', ['ngRoute', '$strap.directives']);
// angular.module('grafana.panels', []);
// angular.module('grafana.controllers', []);
// angular.module('grafana.directives', []);
// angular.module('grafana.filters', []);
// angular.module('grafana.routes', ['ngRoute']);

const context = require.context('../', true, /_specs\.ts/);
context.keys().forEach(context);
module.exports = context;



