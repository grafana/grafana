///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import config from 'app/core/config';
import {coreModule, appEvents} from 'app/core/core';

import './options';
import './add_panel';

export class DashRowCtrl {
  dashboard: any;
  row: any;
  dropView: number;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $timeout) {
    this.row.title = this.row.title || 'Row title';
  }

  toggleCollapse() {
    this.row.collapse = !this.row.collapse;
  }

  onMenuDeleteRow() {
    this.dashboard.removeRow(this.row);
  }
}

coreModule.directive('dashRow', function($rootScope) {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/row.html',
    controller: DashRowCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: "=",
      row: "=",
    },
    link: function(scope, element) {
      scope.$watchGroup(['ctrl.row.collapse', 'ctrl.row.height'], function() {
        element.toggleClass('dash-row--collapse', scope.ctrl.row.collapse);
      });
    }
  };
});

