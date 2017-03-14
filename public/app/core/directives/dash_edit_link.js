define([
  'jquery',
  '../core_module',
],
function ($, coreModule) {
  'use strict';

  var editViewMap = {
    'settings':    { src: 'public/app/features/dashboard/partials/settings.html'},
    'annotations': { src: 'public/app/features/annotations/partials/editor.html'},
    'templating':  { src: 'public/app/features/templating/partials/editor.html'},
    'import':      { src: '<dash-import></dash-import>' }
  };

  coreModule.default.directive('dashEditorView', function($compile, $location, $rootScope) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var editorScope;
        var lastEditor;

        function hideEditorPane() {
          if (editorScope) {
            scope.appEvent('dash-editor-hidden', lastEditor);
            editorScope.dismiss();
          }
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

          lastEditor = payload.src;
          editorScope = payload.scope ? payload.scope.$new() : scope.$new();

          editorScope.dismiss = function() {
            editorScope.$destroy();
            elem.empty();
            lastEditor = null;
            editorScope = null;

            if (editview) {
              var urlParams = $location.search();
              if (editview === urlParams.editview) {
                delete urlParams.editview;
                $location.search(urlParams);
              }
            }
          };

          if (editview === 'import') {
            var modalScope = $rootScope.$new();
            modalScope.$on("$destroy", function() {
              editorScope.dismiss();
            });

            $rootScope.appEvent('show-modal', {
              templateHtml: '<dash-import></dash-import>',
              scope: modalScope,
              backdrop: 'static'
            });

            return;
          }

          var view = payload.src;
          if (view.indexOf('.html') > 0)  {
            view = $('<div class="tabbed-view" ng-include="' + "'" + view + "'" + '"></div>');
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
