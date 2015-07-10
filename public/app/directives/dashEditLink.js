define([
  'angular',
  'jquery'
],
function (angular, $) {
  'use strict';

  var editViewMap = {
    'settings':    { src: 'app/features/dashboard/partials/settings.html', title: "Settings" },
    'annotations': { src: 'app/features/annotations/partials/editor.html', title: "Annotations" },
    'templating':  { src: 'app/features/templating/partials/editor.html', title: "Templating" }
  };

  angular
    .module('grafana.directives')
    .directive('dashEditorLink', function($timeout) {
      return {
        restrict: 'A',
        link: function(scope, elem, attrs) {
          var partial = attrs.dashEditorLink;

          elem.bind('click',function() {
            $timeout(function() {
              var editorScope = attrs.editorScope === 'isolated' ? null : scope;
              scope.appEvent('show-dash-editor', { src: partial, scope: editorScope });
            });
          });
        }
      };
    });

  angular
    .module('grafana.directives')
    .directive('dashEditorView', function($compile, $location) {
      return {
        restrict: 'A',
        link: function(scope, elem) {
          var editorScope;
          var lastEditor;

          function hideScrollbars(value) {
            if (value) {
              window.scrollTo(0,0);
              document.documentElement.style.overflow = 'hidden';  // firefox, chrome
              document.body.scroll = "no"; // ie only
            } else {
              document.documentElement.style.overflow = 'auto';
              document.body.scroll = "yes";
            }
          }

          function hideEditorPane() {
            hideScrollbars(false);
            if (editorScope) { editorScope.dismiss(); }
          }

          function showEditorPane(evt, payload, editview) {
            if (editview) {
              scope.contextSrv.editview = editViewMap[editview];
              payload.src = scope.contextSrv.editview.src;
            }

            if (lastEditor === payload.src) {
              hideEditorPane();
              return;
            }

            hideEditorPane();

            scope.exitFullscreen();

            lastEditor = payload.src;
            editorScope = payload.scope ? payload.scope.$new() : scope.$new();

            editorScope.dismiss = function() {
              editorScope.$destroy();
              elem.empty();
              lastEditor = null;
              editorScope = null;
              hideScrollbars(false);

              if (editview) {
                var urlParams = $location.search();
                if (editview === urlParams.editview) {
                  delete urlParams.editview;
                  $location.search(urlParams);
                }
              }
            };

            // hide page scrollbars while edit pane is visible
            hideScrollbars(true);

            var src = "'" + payload.src + "'";
            var view = $('<div class="gf-box" ng-include="' + src + '"></div>');

            if (payload.cssClass) {
              view.addClass(payload.cssClass);
            }

            elem.append(view);
            $compile(elem.contents())(editorScope);
          }

          scope.$watch("dashboardViewState.state.editview", function(newValue, oldValue) {
            if (newValue) {
              showEditorPane(null, {}, newValue);
            } else if (oldValue) {
              scope.contextSrv.editview = null;
              if (lastEditor === editViewMap[oldValue]) {
                hideEditorPane();
              }
            }
          });

          scope.contextSrv.editview = null;
          scope.$on("$destroy", hideEditorPane);
          scope.onAppEvent('hide-dash-editor', hideEditorPane);
          scope.onAppEvent('show-dash-editor', showEditorPane);
        }
      };
    });
});
