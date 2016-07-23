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

        var lastHideControlsVal;

        $scope.onAppEvent('panel-fullscreen-enter', function() {
          elem.toggleClass('panel-in-fullscreen', true);
        });

        $scope.onAppEvent('panel-fullscreen-exit', function() {
          elem.toggleClass('panel-in-fullscreen', false);
        });

        $scope.$watch('dashboard.hideControls', function() {
          if (!$scope.dashboard) {
            return;
          }

          var hideControls = $scope.dashboard.hideControls || $scope.playlist_active;

          if (lastHideControlsVal !== hideControls) {
            elem.toggleClass('hide-controls', hideControls);
            lastHideControlsVal = hideControls;
          }
        });

        $scope.$watch('playlistSrv', function(newValue) {
          elem.toggleClass('playlist-active', _.isObject(newValue));
        });
      }
    };
  });

});
