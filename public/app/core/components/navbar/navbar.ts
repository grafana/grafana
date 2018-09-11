import coreModule from '../../core_module';
import { NavModel } from '../../nav_model_srv';
import appEvents from 'app/core/app_events';

export class NavbarCtrl {
  model: NavModel;

  /** @ngInject */
  constructor() {}

  showSearch() {
    appEvents.emit('show-dash-search');
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
      model: '=',
    },
    link: (scope, elem) => {},
  };
}

export function pageH1() {
  return {
    restrict: 'E',
    template: `
    <h1 class="page-header__title">
      <i class="page-header__icon {{::model.header.icon}}" ng-if="::model.header.icon"></i>
      <img class="page-header__img" ng-src="{{::model.header.img}}" ng-if="::model.header.img"></i>
      {{model.header.text}}
    </h1>
    `,
    scope: {
      model: '=',
    },
  };
}

coreModule.directive('pageH1', pageH1);
coreModule.directive('navbar', navbarDirective);
