///<reference path="../../../headers/common.d.ts" />

import coreModule from '../../core_module';
import {NavModel, NavModelItem}  from '../../nav_model_srv';

export class NavbarCtrl {
  model: NavModel;
  section: NavModelItem;
  hasMenu: boolean;

  /** @ngInject */
  constructor(private $rootScope, private contextSrv) {
    this.section = this.model.section;
    this.hasMenu = this.model.menu.length > 0;
  }

  showSearch() {
    this.$rootScope.appEvent('show-dash-search');
  }

  toggleSideMenu() {
    this.contextSrv.toggleSideMenu();
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
    transclude: true,
    controllerAs: 'ctrl',
    scope: {
      model: "=",
    },
    link: function(scope, elem) {
      elem.addClass('navbar');
    }
  };
}

coreModule.directive('navbar', navbarDirective);
