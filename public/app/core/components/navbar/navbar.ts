///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';

export class NavbarCtrl {
  /** @ngInject */
  constructor(private $scope, private contextSrv) {
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
    link: function(scope, elem, attrs, ctrl) {
      ctrl.icon = attrs.icon;
      ctrl.subnav = attrs.subnav;
    }
  };
}

coreModule.directive('navbar', navbarDirective);
