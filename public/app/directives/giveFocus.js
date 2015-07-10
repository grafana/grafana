define([
  'angular'
],
function (angular) {
  'use strict';

  angular.module('grafana.directives').directive('giveFocus', function() {
    return function(scope, element, attrs) {
      element.click(function(e) {
        e.stopPropagation();
      });

      scope.$watch(attrs.giveFocus,function (newValue) {
        if (!newValue) {
          return;
        }
        setTimeout(function() {
          element.focus();
          var pos = element.val().length * 2;
          element[0].setSelectionRange(pos, pos);
        }, 200);
      },true);
    };
  });

});
