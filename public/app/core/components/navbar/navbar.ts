///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';
import {NavModel, NavModelItem}  from '../../nav_model_srv';

export class NavbarCtrl {
  model: NavModel;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private contextSrv) {
  }

  showSearch() {
    this.$rootScope.appEvent('show-dash-search');
  }

  navItemClicked(navItem, evt) {
    if (navItem.clickHandler) {
      navItem.clickHandler();
      evt.preventDefault();
    }
  }
}

export function navbarDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/navbar/navbar.html',
    controller: NavbarCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      model: "=",
    },
    link: function(scope, elem) {
    }
  };
}

export function pageH1() {
  return {
    restrict: 'E',
    template: `
    <h1>
    <i class="{{::model.node.icon}}" ng-if="::model.node.icon"></i>
    <img ng-src="{{::model.node.img}}" ng-if="::model.node.img"></i>
    {{model.node.text}}
    </h1>
    `,
    scope: {
      model: "=",
    }
  };
}


coreModule.directive('pageH1', pageH1);
coreModule.directive('navbar', navbarDirective);
