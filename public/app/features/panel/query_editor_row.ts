///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import $ from 'jquery';

var module = angular.module('grafana.directives');

/** @ngInject **/
function queryEditorRowDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/panel/partials/query_editor_row.html',
    transclude: true,
    scope: {ctrl: "="},
  };
}

module.directive('queryEditorRow', queryEditorRowDirective);
