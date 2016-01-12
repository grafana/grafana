///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import {MixedDatasource} from './datasource';

var module = angular.module('grafana.directives');

module.directive('metricQueryEditorMixed', function() {
  return {templateUrl: 'app/plugins/datasource/mixed/partials/query.editor.html'};
});


export {MixedDatasource, MixedDatasource as Datasource};

