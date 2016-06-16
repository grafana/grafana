///<reference path="../../headers/common.d.ts" />

import './dashboard_loaders';

import angular from 'angular';
import coreModule from 'app/core/core_module';
import {BundleLoader} from './bundle_loader';

/** @ngInject **/
function setupAngularRoutes($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true);

  var loadOrgBundle = new BundleLoader('app/features/org/all');
  var loadPluginsBundle = new BundleLoader('app/features/plugins/all');
  var loadAdminBundle = new BundleLoader('app/features/admin/admin');

  $routeProvider
  .when('/', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'LoadDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/dashboard/:type/:slug', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'LoadDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/dashboard-solo/:type/:slug', {
    templateUrl: 'public/app/features/panel/partials/soloPanel.html',
    controller : 'SoloPanelCtrl',
    pageClass: 'page-dashboard',
  })
  .when('/dashboard/new', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'NewDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/dashboards/list', {
    templateUrl: 'public/app/features/dashboard/partials/dash_list.html',
    controller : 'DashListCtrl',
  })
  .when('/dashboards/migrate', {
    templateUrl: 'public/app/features/dashboard/partials/migrate.html',
    controller : 'DashboardImportCtrl',
  })
  .when('/datasources', {
    templateUrl: 'public/app/features/plugins/partials/ds_list.html',
    controller : 'DataSourcesCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/datasources/edit/:id', {
    templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
    controller : 'DataSourceEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/datasources/new', {
    templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
    controller : 'DataSourceEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/org', {
    templateUrl: 'public/app/features/org/partials/orgDetails.html',
    controller : 'OrgDetailsCtrl',
    resolve: loadOrgBundle,
  })
  .when('/org/new', {
    templateUrl: 'public/app/features/org/partials/newOrg.html',
    controller : 'NewOrgCtrl',
    resolve: loadOrgBundle,
  })
  .when('/org/users', {
    templateUrl: 'public/app/features/org/partials/orgUsers.html',
    controller : 'OrgUsersCtrl',
    controllerAs: 'ctrl',
    resolve: loadOrgBundle,
  })
  .when('/org/apikeys', {
    templateUrl: 'public/app/features/org/partials/orgApiKeys.html',
    controller : 'OrgApiKeysCtrl',
    resolve: loadOrgBundle,
  })
  .when('/profile', {
    templateUrl: 'public/app/features/org/partials/profile.html',
    controller : 'ProfileCtrl',
    controllerAs: 'ctrl',
    resolve: loadOrgBundle,
  })
  .when('/profile/password', {
    templateUrl: 'public/app/features/org/partials/change_password.html',
    controller : 'ChangePasswordCtrl',
    resolve: loadOrgBundle,
  })
  .when('/profile/select-org', {
    templateUrl: 'public/app/features/org/partials/select_org.html',
    controller : 'SelectOrgCtrl',
    resolve: loadOrgBundle,
  })
  // ADMIN
  .when('/admin', {
    templateUrl: 'public/app/features/admin/partials/admin_home.html',
    controller : 'AdminHomeCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/settings', {
    templateUrl: 'public/app/features/admin/partials/settings.html',
    controller : 'AdminSettingsCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users', {
    templateUrl: 'public/app/features/admin/partials/users.html',
    controller : 'AdminListUsersCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users/create', {
    templateUrl: 'public/app/features/admin/partials/new_user.html',
    controller : 'AdminEditUserCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users/edit/:id', {
    templateUrl: 'public/app/features/admin/partials/edit_user.html',
    controller : 'AdminEditUserCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/orgs', {
    templateUrl: 'public/app/features/admin/partials/orgs.html',
    controller : 'AdminListOrgsCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/orgs/edit/:id', {
    templateUrl: 'public/app/features/admin/partials/edit_org.html',
    controller : 'AdminEditOrgCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/stats', {
    templateUrl: 'public/app/features/admin/partials/stats.html',
    controller : 'AdminStatsCtrl',
    controllerAs: 'ctrl',
    resolve: loadAdminBundle,
  })
  // LOGIN / SIGNUP
  .when('/login', {
    templateUrl: 'public/app/partials/login.html',
    controller : 'LoginCtrl',
  })
  .when('/invite/:code', {
    templateUrl: 'public/app/partials/signup_invited.html',
    controller : 'InvitedCtrl',
  })
  .when('/signup', {
    templateUrl: 'public/app/partials/signup_step2.html',
    controller : 'SignUpCtrl',
  })
  .when('/user/password/send-reset-email', {
    templateUrl: 'public/app/partials/reset_password.html',
    controller : 'ResetPasswordCtrl',
  })
  .when('/user/password/reset', {
    templateUrl: 'public/app/partials/reset_password.html',
    controller : 'ResetPasswordCtrl',
  })
  .when('/dashboard/snapshots', {
    templateUrl: 'public/app/features/snapshot/partials/snapshots.html',
    controller : 'SnapshotsCtrl',
    controllerAs: 'ctrl',
  })
  .when('/plugins', {
    templateUrl: 'public/app/features/plugins/partials/plugin_list.html',
    controller: 'PluginListCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/plugins/:pluginId/edit', {
    templateUrl: 'public/app/features/plugins/partials/plugin_edit.html',
    controller: 'PluginEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/plugins/:pluginId/page/:slug', {
    templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
    controller: 'AppPageCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/global-alerts', {
    templateUrl: 'public/app/features/dashboard/partials/globalAlerts.html',
  })
  .when('/styleguide/:page?', {
    controller: 'StyleGuideCtrl',
    controllerAs: 'ctrl',
    templateUrl: 'public/app/features/styleguide/styleguide.html',
  })
  .otherwise({
    templateUrl: 'public/app/partials/error.html',
    controller: 'ErrorCtrl'
  });
}

coreModule.config(setupAngularRoutes);
