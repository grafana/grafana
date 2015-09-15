define([
  'lodash',
  'jquery',
  '../core_module',
],
function (_, $, coreModule) {
  'use strict';

  coreModule.directive('bodyClass', function() {
    return {
      link: function($scope, elem) {

        var lastHideControlsVal;

        // tooltip removal fix
        $scope.$on("$routeChangeSuccess", function() {
          $("#tooltip, .tooltip").remove();
        });

<<<<<<< 48cb73f5f674dc00ac540a966fd8c20991da8c92
=======
        $scope.$watch('submenuEnabled', function() {
          if (!$scope.dashboard) {
            return;
          }

          elem.toggleClass('submenu-controls-visible', $scope.submenuEnabled);
        });

>>>>>>> refactor: improving structure, moving things into a core module
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
