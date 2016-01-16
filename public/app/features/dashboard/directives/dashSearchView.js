define([
  'angular',
  'jquery'
],
function (angular, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('dashSearchView', function($compile) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          var editorScope;
          var ignoreHide;

          function showSearch() {
            if (editorScope) {
              editorScope.dismiss();
              return;
            }

            ignoreHide = true;
            editorScope = scope.$new();
            editorScope.dismiss = function() {
              editorScope.$destroy();
              elem.empty();
              elem.unbind();
              editorScope = null;
            };

            var view = $('<div class="search-container" ng-include="\'app/partials/search.html\'"></div>');

            elem.append(view);
            $compile(elem.contents())(editorScope);

            setTimeout(function() {
              ignoreHide = false;
            }, 300);
          }

          function hideSearch() {
            if (editorScope && !ignoreHide) {
              editorScope.dismiss();
            }
          }

          scope.onAppEvent('show-dash-search', showSearch);
          scope.onAppEvent('hide-dash-search', hideSearch);
        }
      };
    });

});
