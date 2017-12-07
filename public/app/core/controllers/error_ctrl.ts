import config from 'app/core/config';
import coreModule from '../core_module';

export class ErrorCtrl {

  /** @ngInject */
  constructor($scope, contextSrv, navModelSrv) {
    $scope.navModel = navModelSrv.getNotFoundNav();
    $scope.appSubUrl = config.appSubUrl;

    var showSideMenu = contextSrv.sidemenu;
    contextSrv.sidemenu = false;

    $scope.$on('$destroy', function() {
      contextSrv.sidemenu = showSideMenu;
    });
  }
}

coreModule.controller('ErrorCtrl', ErrorCtrl);
