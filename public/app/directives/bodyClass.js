define([
  'angular',
  'lodash',
  'jquery'
],
function (angular, _, $) {
  'use strict';

  angular
    .module('grafana.directives')
    .directive('bodyClass', function() {
      return {
        link: function($scope, elem) {

          var lastHideControlsVal;

          // tooltip removal fix
          $scope.$on("$routeChangeSuccess", function() {
            $("#tooltip, .tooltip").remove();
          });

          $scope.$watch('submenuEnabled', function() {
            if (!$scope.dashboard) {
              return;
            }

            elem.toggleClass('submenu-controls-visible', $scope.submenuEnabled);
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
