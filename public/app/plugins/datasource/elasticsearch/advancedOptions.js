define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('tightFormAdvancedOption', function($compile, uiSegmentSrv, $q) {
      return {
        templateUrl: 'app/plugins/datasource/elasticsearch/partials/advancedOption.html',
        restrict: 'E',
        scope: {
          model: "=",
          option: "=",
        },
        link: function postLink($scope, elem) {
        }
      };
    });
});
