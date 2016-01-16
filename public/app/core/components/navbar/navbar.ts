///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';

export class NavbarCtrl {
  contextSrv: any;

  /** @ngInject */
  constructor(private $scope, contextSrv) {
    this.contextSrv = contextSrv;
  }
}

export function navbarDirective() {
  return {
    restrict: 'E',
    templateUrl: 'app/core/components/navbar/navbar.html',
    controller: NavbarCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    transclude: true,
    scope: {
      title: "@",
      titleUrl: "@",
    },
    link: function(scope, elem, attrs) {
      scope.icon = attrs.icon;
      scope.subnav = attrs.subnav;
    }
  };
}

coreModule.directive('navbar', navbarDirective);
