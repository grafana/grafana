define([
  'angular',
  'app',
  'underscore'
],
function (angular, app, _) {
  'use strict';

  angular
    .module('kibana.directives')
    .directive('bodyClass', function() {
      return {
        link: function($scope, elem) {

          var lastPulldownVal;
          var lastHideControlsVal;

          $scope.$watch('dashboard.pulldowns', function() {
            if (!$scope.dashboard) {
              return;
            }

            var panel = _.find($scope.dashboard.pulldowns, function(pulldown) { return pulldown.enable; });
            var panelEnabled = panel ? panel.enable : false;
            if (lastPulldownVal !== panelEnabled) {
              elem.toggleClass('submenu-controls-visible', panelEnabled);
              lastPulldownVal = panelEnabled;
            }
          }, true);

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

          $scope.$watch('playlist_active', function() {
            elem.toggleClass('hide-controls', $scope.playlist_active === true);
            elem.toggleClass('playlist-active', $scope.playlist_active === true);
          });
        }
      };
    });

});