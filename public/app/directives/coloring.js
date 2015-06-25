define([
    'angular',
    'lodash'
  ],
  function(angular, _) {
    'use strict';
    angular
      .module('grafana.directives')
      .directive('coloring', function() {
        return {
          restrict: 'A',
          scope: {
            target: '=',
            render: '&'
          },
          templateUrl: 'app/directives/coloring.html',
          link: function(scope) {
            var _d = {
              thresholdCommaString: '',
              thresholdValues: [],
              colorBackground: false,
              colorValue: false,
              colors: ["rgba(245, 54, 54, 0.9)", "rgba(237, 129, 40, 0.89)", "rgba(50, 172, 45, 0.97)"]
            };

            scope.target.coloring = scope.target.coloring || {};
            _.defaults(scope.target.coloring, _d);
            var coloring = scope.target.coloring;

            scope.invertColorOrder = function() {
              var tmp = coloring.colors[0];
              coloring.colors[0] = coloring.colors[2];
              coloring.colors[2] = tmp;
              scope.render();
            };

            scope.$watch('target.coloring.thresholdCommaString', function() {
              if (!coloring.thresholdCommaString) {
                coloring.thresholdValues = [];
                return;
              }

              coloring.thresholdValues = coloring.thresholdCommaString.split(',').map(function(strValue) {
                return Number(strValue.trim());
              });
            });
          }
        };
      });
  }
);