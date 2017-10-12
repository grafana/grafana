define([
  'angular',
  'app/core/config',
  '../core_module',
],
function (angular, config, coreModule) {
  'use strict';

  coreModule.default.controller('ErrorCtrl', function($scope, contextSrv, navModelSrv) {

    $scope.navModel = navModelSrv.getNotFoundNav();
    $scope.appSubUrl = config.appSubUrl;

    var showSideMenu = contextSrv.sidemenu;
    contextSrv.sidemenu = false;

    $scope.$on('$destroy', function() {
      contextSrv.sidemenu = showSideMenu;
    });

  });

});
