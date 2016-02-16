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
    templateUrl: 'public/app/core/components/navbar/navbar.html',
    controller: NavbarCtrl,
    bindToController: true,
    transclude: true,
    controllerAs: 'ctrl',
    scope: {
      title: "@",
      titleUrl: "@",
    },
    link: function(scope, elem, attrs, ctrl) {
      ctrl.icon = attrs.icon;
      elem.addClass('navbar');
    }
  };
}

var navButtonTemplate = `
<div class="top-nav-btn dashnav-dashboards-btn">
  <a href="{{::titleUrl}}">
    <i class="{{::icon}}"></i>
    <span class="dashboard-title">{{::title}}</span>
  </a>
</div>
`;

function navButton() {
  return {
    restrict: 'E',
    template: navButtonTemplate,
    scope: {
      title: "@",
      titleUrl: "@",
    },
    link: function(scope, elem, attrs, ctrl) {
      scope.icon = attrs.icon;
    }
  };
}

coreModule.directive('navbar', navbarDirective);
coreModule.directive('navButton', navButton);
