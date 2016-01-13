///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {GrafanaDatasource} from './datasource';

var module = angular.module('grafana.directives');

module.directive('metricQueryEditorGrafana', function() {
  return {templateUrl: 'app/plugins/datasource/grafana/partials/query.editor.html'};
});


export {GrafanaDatasource, GrafanaDatasource as Datasource};

