define([
  'angular',
  '../core_module',
],
function (angular, coreModule) {
  'use strict';

  coreModule.default.controller('ErrorCtrl', function($scope, contextSrv) {

    var showSideMenu = contextSrv.sidemenu;
    contextSrv.sidemenu = false;

    $scope.$on('$destroy', function() {
      $scope.contextSrv.sidemenu = showSideMenu;
    });

  });

});
