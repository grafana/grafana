import _ from 'lodash';
import config from 'app/core/config';
import $ from 'jquery';
import coreModule from '../../core_module';
import appEvents from 'app/core/app_events';

export class SideMenuCtrl {
  user: any;
  mainLinks: any;
  bottomNav: any;
  loginUrl: string;
  isSignedIn: boolean;
  isOpenMobile: boolean;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $location, private contextSrv, private $timeout) {
    this.isSignedIn = contextSrv.isSignedIn;
    this.user = contextSrv.user;

    let navTree = _.cloneDeep(config.bootData.navTree);
    this.mainLinks = _.filter(navTree, item => !item.hideFromMenu);
    this.bottomNav = _.filter(navTree, item => item.hideFromMenu);
    this.loginUrl = 'login?redirect=' + encodeURIComponent(this.$location.path());

    if (contextSrv.user.orgCount > 1) {
      let profileNode = _.find(this.bottomNav, { id: 'profile' });
      if (profileNode) {
        profileNode.showOrgSwitcher = true;
      }
    }

    this.$scope.$on('$routeChangeSuccess', () => {
      this.loginUrl = 'login?redirect=' + encodeURIComponent(this.$location.path());
    });
  }

  toggleSideMenu() {
    this.contextSrv.toggleSideMenu();
    appEvents.emit('toggle-sidemenu');

    this.$timeout(() => {
      this.$rootScope.$broadcast('render');
    });
  }

  toggleSideMenuSmallBreakpoint() {
    appEvents.emit('toggle-sidemenu-mobile');
  }

  switchOrg() {
    this.$rootScope.appEvent('show-modal', {
      templateHtml: '<org-switcher dismiss="dismiss()"></org-switcher>',
    });
  }

  itemClicked(item, evt) {
    if (item.url === '/shortcuts') {
      appEvents.emit('show-modal', {
        templateHtml: '<help-modal></help-modal>',
      });
      evt.preventDefault();
    }
  }
}

export function sideMenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/sidemenu/sidemenu.html',
    controller: SideMenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
    link: function(scope, elem) {
      // hack to hide dropdown menu
      elem.on('click.dropdown', '.dropdown-menu a', function(evt) {
        var menu = $(evt.target).parents('.dropdown-menu');
        var parent = menu.parent();
        menu.detach();

        setTimeout(function() {
          parent.append(menu);
        }, 100);
      });
    },
  };
}

coreModule.directive('sidemenu', sideMenuDirective);
