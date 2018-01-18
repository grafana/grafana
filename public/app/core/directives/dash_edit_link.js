define([
  'jquery',
  'angular',
  '../core_module',
  'lodash',
],
function ($, angular, coreModule, _) {
  'use strict';

  var editViewMap = {
    'settings':    { src: 'public/app/features/dashboard/partials/settings.html'},
    'annotations': { src: 'public/app/features/annotations/partials/editor.html'},
    'templating':  { src: 'public/app/features/templating/partials/editor.html'},
    'history':     { html: '<gf-dashboard-history dashboard="dashboard"></gf-dashboard-history>'},
    'timepicker':  { src: 'public/app/features/dashboard/timepicker/dropdown.html' },
    'import':      { html: '<dash-import dismiss="dismiss()"></dash-import>', isModal: true },
    'permissions': { html: '<dash-acl-modal dismiss="dismiss()"></dash-acl-modal>', isModal: true },
    'new-folder':  {
      isModal: true,
      html: '<folder-modal dismiss="dismiss()"></folder-modal>',
      modalClass: 'modal--narrow'
    }
  };

  coreModule.default.directive('dashEditorView', function($compile, $location, $rootScope) {
    return {
      restrict: 'A',
      link: function(scope, elem) {
        var editorScope;
        var modalScope;
        var lastEditView;

        function hideEditorPane(hideToShowOtherView) {
          if (editorScope) {
            editorScope.dismiss(hideToShowOtherView);
          }
        }

        function showEditorPane(evt, options) {
          if (options.editview) {
            _.defaults(options, editViewMap[options.editview]);
          }

          if (lastEditView && lastEditView === options.editview) {
            hideEditorPane(false);
            return;
          }

          hideEditorPane(true);

          lastEditView = options.editview;
          editorScope = options.scope ? options.scope.$new() : scope.$new();

          editorScope.dismiss = function(hideToShowOtherView) {
            if (modalScope) {
              modalScope.dismiss();
              modalScope = null;
            }

            editorScope.$destroy();
            lastEditView = null;
            editorScope = null;
            elem.removeClass('dash-edit-view--open');

            if (!hideToShowOtherView) {
              setTimeout(function() {
                elem.empty();
              }, 250);
            }

            if (options.editview) {
              var urlParams = $location.search();
              if (options.editview === urlParams.editview) {
                delete urlParams.editview;

                // even though we always are in apply phase here
                // some angular bug is causing location search updates to
                // not happen always so this is a hack fix or that
                setTimeout(function() {
                  $rootScope.$apply(function() {
                    $location.search(urlParams);
                  });
                });
              }
            }
          };

          if (options.isModal) {
            modalScope = $rootScope.$new();
            modalScope.$on("$destroy", function() {
              editorScope.dismiss();
            });

            $rootScope.appEvent('show-modal', {
              templateHtml: options.html,
              scope: modalScope,
              backdrop: 'static',
              modalClass: options.modalClass,
            });

            return;
          }

          var view;
          if (options.src)  {
            view = angular.element(document.createElement('div'));
            view.html('<div class="tabbed-view" ng-include="' + "'" + options.src + "'" + '"></div>');
          } else {
            view = angular.element(document.createElement('div'));
            view.addClass('tabbed-view');
            view.html(options.html);
          }

          $compile(view)(editorScope);

          setTimeout(function() {
            elem.empty();
            elem.append(view);
            setTimeout(function() {
              elem.addClass('dash-edit-view--open');
            }, 10);
          }, 10);
        }

        scope.$watch("ctrl.dashboardViewState.state.editview", function(newValue, oldValue) {
          if (newValue) {
            showEditorPane(null, {editview: newValue});
          } else if (oldValue) {
            if (lastEditView === oldValue) {
              hideEditorPane();
            }
          }
        });

        scope.$on("$destroy", hideEditorPane);

        scope.onAppEvent('hide-dash-editor', function() {
          hideEditorPane(false);
        });

        scope.onAppEvent('show-dash-editor', showEditorPane);

        scope.onAppEvent('panel-fullscreen-enter', function() {
          scope.appEvent('hide-dash-editor');
        });
      }
    };
  });
});

