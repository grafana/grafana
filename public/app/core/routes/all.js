define([
  'angular',
  '../core_module',
  './bundle_loader',
  './dashboard_loaders',
], function(angular, coreModule, BundleLoader) {
  "use strict";

  coreModule.default.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);

    var loadOrgBundle = new BundleLoader.BundleLoader('app/features/org/all');
    var loadAppsBundle = new BundleLoader.BundleLoader('app/features/apps/all');

    $routeProvider
      .when('/', {
        templateUrl: 'public/app/partials/dashboard.html',
        controller : 'LoadDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/:type/:slug', {
        templateUrl: 'public/app/partials/dashboard.html',
        controller : 'LoadDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard-solo/:type/:slug', {
        templateUrl: 'public/app/features/panel/partials/soloPanel.html',
        controller : 'SoloPanelCtrl',
      })
      .when('/dashboard-import/:file', {
        templateUrl: 'public/app/partials/dashboard.html',
        controller : 'DashFromImportCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/new', {
        templateUrl: 'public/app/partials/dashboard.html',
        controller : 'NewDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/import/dashboard', {
        templateUrl: 'public/app/features/dashboard/partials/import.html',
        controller : 'DashboardImportCtrl',
      })
      .when('/datasources', {
        templateUrl: 'public/app/features/datasources/partials/list.html',
        controller : 'DataSourcesCtrl',
        resolve: loadOrgBundle,
      })
      .when('/datasources/edit/:id', {
        templateUrl: 'public/app/features/datasources/partials/edit.html',
        controller : 'DataSourceEditCtrl',
        resolve: loadOrgBundle,
      })
      .when('/datasources/new', {
        templateUrl: 'public/app/features/datasources/partials/edit.html',
        controller : 'DataSourceEditCtrl',
        resolve: loadOrgBundle,
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
        resolve: loadOrgBundle,
      })
      .when('/org/apikeys', {
        templateUrl: 'public/app/features/org/partials/orgApiKeys.html',
        controller : 'OrgApiKeysCtrl',
        resolve: loadOrgBundle,
      })
      .when('/profile', {
        templateUrl: 'public/app/features/profile/partials/profile.html',
        controller : 'ProfileCtrl',
      })
      .when('/profile/password', {
        templateUrl: 'public/app/features/profile/partials/password.html',
        controller : 'ChangePasswordCtrl',
      })
      .when('/profile/select-org', {
        templateUrl: 'public/app/features/profile/partials/select_org.html',
        controller : 'SelectOrgCtrl',
      })
      .when('/admin/settings', {
        templateUrl: 'public/app/features/admin/partials/settings.html',
        controller : 'AdminSettingsCtrl',
      })
      .when('/admin/users', {
        templateUrl: 'public/app/features/admin/partials/users.html',
        controller : 'AdminListUsersCtrl',
      })
      .when('/admin/users/create', {
        templateUrl: 'public/app/features/admin/partials/new_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/admin/users/edit/:id', {
        templateUrl: 'public/app/features/admin/partials/edit_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/admin/orgs', {
        templateUrl: 'public/app/features/admin/partials/orgs.html',
        controller : 'AdminListOrgsCtrl',
      })
      .when('/admin/orgs/edit/:id', {
        templateUrl: 'public/app/features/admin/partials/edit_org.html',
        controller : 'AdminEditOrgCtrl',
      })
      .when('/admin/stats', {
        templateUrl: 'public/app/features/admin/partials/stats.html',
        controller : 'AdminStatsCtrl',
        controllerAs: 'ctrl',
      })
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
      .when('/apps', {
        templateUrl: 'public/app/features/apps/partials/list.html',
        controller: 'AppListCtrl',
        controllerAs: 'ctrl',
        resolve: loadAppsBundle,
      })
      .when('/apps/edit/:appId', {
        templateUrl: 'public/app/features/apps/partials/edit.html',
        controller: 'AppEditCtrl',
        controllerAs: 'ctrl',
        resolve: loadAppsBundle,
      })
      .when('/global-alerts', {
        templateUrl: 'public/app/features/dashboard/partials/globalAlerts.html',
      })
      .otherwise({
        templateUrl: 'public/app/partials/error.html',
        controller: 'ErrorCtrl'
      });
  });

});
