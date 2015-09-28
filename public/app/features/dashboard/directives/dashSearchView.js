define([
  'angular',
  'jquery'
],
function (angular, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('dashSearchView', function($compile, $timeout) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          var editorScope;

          function hookUpHideWhenClickedOutside() {
            $timeout(function() {
              $(document).bind('click.hide-search', function(evt) {
                // some items can be inside container
                // but then removed
                if ($(evt.target).parents().length === 0) {
                  return;
                }

                if ($(evt.target).parents('.search-container').length === 0) {
                  if (editorScope) {
                    editorScope.dismiss();
                  }
                }
              });
            });
          }

          function showSearch() {
            if (editorScope) {
              editorScope.dismiss();
              return;
            }

            editorScope = scope.$new();
            editorScope.dismiss = function() {
              editorScope.$destroy();
              elem.empty();
              elem.unbind();
              editorScope = null;
              $(document).unbind('click.hide-search');
            };

            var view = $('<div class="search-container" ng-include="\'app/partials/search.html\'"></div>');

            elem.append(view);
            $compile(elem.contents())(editorScope);

            hookUpHideWhenClickedOutside();
          }

          function hideSearch() {
            if (editorScope) {
              editorScope.dismiss();
            }
          }

          scope.onAppEvent('show-dash-search', showSearch);
          scope.onAppEvent('hide-dash-search', hideSearch);
        }
      };
    });

});
