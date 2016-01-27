///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';

export class SideMenuCtrl {
  isSignedIn: boolean;
  showSignout: boolean;
  user: any;
  mainLinks: any;
  orgMenu: any;
  systemSection: any;
  grafanaVersion: any;
  appSubUrl: string;

  /** @ngInject */
  constructor(private $scope, private $location, private contextSrv, private backendSrv) {
    this.isSignedIn = contextSrv.isSignedIn;
    this.user = contextSrv.user;
    this.appSubUrl = config.appSubUrl;
    this.showSignout = this.contextSrv.isSignedIn && !config['authProxyEnabled'];
    this.updateMenu();
    this.$scope.$on('$routeChangeSuccess', () => {
      this.contextSrv.sidemenu = false;
    });
  }

 getUrl(url) {
   return config.appSubUrl + url;
 }

 setupMainNav() {
   this.mainLinks = config.bootData.mainNavLinks.map(item => {
     return {text: item.text, icon: item.icon, img: item.img, url: this.getUrl(item.url)};
   });
 }

 openUserDropdown() {
   this.orgMenu = [
     {section: 'You', cssClass: 'dropdown-menu-title'},
     {text: 'Preferences', url: this.getUrl('/profile')},
     {text: 'Profile', url: this.getUrl('/profile')},
   ];

   if (this.isSignedIn) {
     this.orgMenu.push({text: "Sign out", url: this.getUrl("/logout"), target: "_self"});
   }

   if (this.contextSrv.hasRole('Admin')) {
     this.orgMenu.push({section: this.user.orgName, cssClass: 'dropdown-menu-title'});
     this.orgMenu.push({
       text: "Preferences",
       url: this.getUrl("/org"),
     });
     this.orgMenu.push({
       text: "Users",
       url: this.getUrl("/org/users"),
     });
     this.orgMenu.push({
       text: "API Keys",
       url: this.getUrl("/org/apikeys"),
     });
   }

   this.orgMenu.push({cssClass: "divider"});

   if (this.contextSrv.isGrafanaAdmin) {
     this.orgMenu.push({text: "Grafana adminstration", icon: "fa fa-fw fa-cogs", url: this.getUrl("/admin/settings")});
   }

   this.backendSrv.get('/api/user/orgs').then(orgs => {
     orgs.forEach(org => {
       if (org.orgId === this.contextSrv.user.orgId) {
         return;
       }

       this.orgMenu.push({
         text: "Switch to " + org.name,
         icon: "fa fa-fw fa-random",
         click: () => {
           this.switchOrg(org.orgId);
         }
       });

       if (config.allowOrgCreate) {
         this.orgMenu.push({text: "New organization", icon: "fa fa-fw fa-plus", url: this.getUrl('/org/new')});
       }
     });
   });
 }

 switchOrg(orgId) {
   this.backendSrv.post('/api/user/using/' + orgId).then(() => {
     window.location.href = window.location.href;
   });
 };

 setupAdminNav() {
   this.systemSection = true;
   this.grafanaVersion = config.buildInfo.version;

   this.mainLinks.push({
     text: "System info",
     icon: "fa fa-fw fa-info",
     url: this.getUrl("/admin/settings"),
   });

   this.mainLinks.push({
     text: "Global Users",
     icon: "fa fa-fw fa-user",
     url: this.getUrl("/admin/users"),
   });

   this.mainLinks.push({
     text: "Global Orgs",
     icon: "fa fa-fw fa-users",
     url: this.getUrl("/admin/orgs"),
   });
 }

 updateMenu() {
   this.systemSection = false;
   this.mainLinks = [];
   this.orgMenu = [];

   var currentPath = this.$location.path();
   if (currentPath.indexOf('/admin') === 0) {
     this.setupAdminNav();
   } else {
     this.setupMainNav();
   }
 };
}

export function sideMenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'app/core/components/sidemenu/sidemenu.html',
    controller: SideMenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {},
  };
}

coreModule.directive('sidemenu', sideMenuDirective);
