import config from 'app/core/config';
import coreModule from '../core_module';
import appEvents from 'app/core/app_events';
import { toggleSidemenuHidden } from '@grafana/data';

export class ErrorCtrl {
  /** @ngInject */
  constructor($scope: any, contextSrv: any, navModelSrv: any) {
    $scope.navModel = navModelSrv.getNotFoundNav();
    $scope.appSubUrl = config.appSubUrl;

    if (!contextSrv.isSignedIn) {
      appEvents.emit(toggleSidemenuHidden);
    }

    $scope.$on('destroy', () => {
      if (!contextSrv.isSignedIn) {
        appEvents.emit(toggleSidemenuHidden);
      }
    });
  }
}

coreModule.controller('ErrorCtrl', ErrorCtrl);
