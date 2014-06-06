define([
  'angular',
  'kbn'
],
function (angular) {
  'use strict';

  var module = angular.module('kibana.directives');

  module.directive('confirmClick', function() {
    return {
      restrict: 'A',
      link: function(scope, elem, attrs) {
        elem.bind('click', function() {
          var message = attrs.confirmation || "Are you sure you want to do that?";
          if (window.confirm(message)) {
            var action = attrs.confirmClick;
            if (action) {
              scope.$apply(scope.$eval(action));
            }
          }
        });
      },
    };
  });
});