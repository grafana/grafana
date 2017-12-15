define([
  'lodash',
  'jquery',
  '../core_module',
],
function (_, $, coreModule) {
  'use strict';

  coreModule.default.directive('dashClass', function() {
    return {
      link: function($scope, elem) {

        $scope.onAppEvent('panel-fullscreen-enter', function() {
          elem.toggleClass('panel-in-fullscreen', true);
        });

        $scope.onAppEvent('panel-fullscreen-exit', function() {
          elem.toggleClass('panel-in-fullscreen', false);
        });

        $scope.$watch('ctrl.playlistSrv.isPlaying', function(newValue) {
          elem.toggleClass('playlist-active', newValue === true);
        });

        $scope.$watch('ctrl.dashboardViewState.state.editview', function(newValue) {
          if (newValue) {
            elem.toggleClass('dashboard-page--settings-opening', _.isString(newValue));
            setTimeout(function() {
              elem.toggleClass('dashboard-page--settings-open', _.isString(newValue));
            }, 10);
          } else {
            elem.removeClass('dashboard-page--settings-opening');
            elem.removeClass('dashboard-page--settings-open');
          }
        });
      }
    };
  });

});
