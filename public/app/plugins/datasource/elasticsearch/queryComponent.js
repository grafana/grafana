define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('elasticQueryComponent', function($compile, uiSegmentSrv, $q) {

      //var linkTemplate = '<a class="tight-form-item tabindex="1" ng-bind-html="textRep"></a>';
      /* jshint maxlen:false */
      var template1 = '<metric-segment segment="typeSegment" get-alt-segments="getBucketAggTypes()" on-value-changed="bucketAggTypeChanged()"></metric-segment>';
      /* jshint maxlen:false */
      var template2 = '<metric-segment segment="fieldSegment" get-alt-segments="getFields()" on-value-changed="fieldChanged()"></metric-segment>';

      return {
        restrict: 'E',
        scope: {
          model: "=",
          onChange: "&",
          getFields: "&",
        },
        link: function postLink($scope, elem) {

          $scope.getBucketAggTypes = function() {
            return $q.when([
              uiSegmentSrv.newSegment({value: 'terms'}),
              uiSegmentSrv.newSegment({value: 'date_histogram'}),
            ]);
          };

          $scope.fieldChanged = function() {
            $scope.model.field = $scope.fieldSegment.value;
            $scope.onChange();
          };

          $scope.bucketAggTypeChanged = function() {
            $scope.model.type = $scope.typeSegment.value;
            $scope.onChange();
          };

          function addElementsAndCompile() {
            var $html = $(template1 + template2);

            $scope.fieldSegment = uiSegmentSrv.newSegment($scope.model.field);
            $scope.typeSegment = uiSegmentSrv.newSegment($scope.model.type);

            $html.appendTo(elem);

            $compile(elem.contents())($scope);
          }

          addElementsAndCompile();
        }
      };
    });
});
