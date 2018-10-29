import angular from 'angular';
import _ from 'lodash';
import { iconMap } from './editor';

export class CustomTimeRangesCtrl {
  /** @ngInject */
  constructor($scope, $rootScope, $q, rangeDef /*dashboardSrv*/) {
    //    const currentDashId = dashboardSrv.getCurrent().id;

    if (rangeDef.type === 'range') {
      return $q.when([
        {
          icon: iconMap[rangeDef.icon],
        },
      ]);
    }

    return $q.when([]);
  }
}
angular.module('grafana.directives').controller('CustomTimeRangesCtrl', CustomTimeRangesCtrl);
