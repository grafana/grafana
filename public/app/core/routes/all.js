define([
  'angular',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
  '../core_module',
  './bundle_loader',
  './dashboard_loaders',
], function(angular, coreModule, BundleLoader) {
=======
  '../core/core',
  './dashLoadControllers',
], function(angular, core) {
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
  "use strict";

  coreModule.config(function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode(true);

    var loadOrgBundle = new BundleLoader.BundleLoader('app/features/org/all');

    $routeProvider
      .when('/', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'LoadDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/:type/:slug', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'LoadDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard-solo/:type/:slug', {
        templateUrl: 'app/features/panel/partials/soloPanel.html',
        controller : 'SoloPanelCtrl',
      })
      .when('/dashboard-import/:file', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'DashFromImportCtrl',
        reloadOnSearch: false,
      })
      .when('/dashboard/new', {
        templateUrl: 'app/partials/dashboard.html',
        controller : 'NewDashboardCtrl',
        reloadOnSearch: false,
      })
      .when('/import/dashboard', {
        templateUrl: 'app/features/dashboard/partials/import.html',
        controller : 'DashboardImportCtrl',
      })
      .when('/datasources', {
        templateUrl: 'app/features/org/partials/datasources.html',
        controller : 'DataSourcesCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/datasources/edit/:id', {
        templateUrl: 'app/features/org/partials/datasourceEdit.html',
        controller : 'DataSourceEditCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/datasources/new', {
        templateUrl: 'app/features/org/partials/datasourceEdit.html',
        controller : 'DataSourceEditCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/org', {
        templateUrl: 'app/features/org/partials/orgDetails.html',
        controller : 'OrgDetailsCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/org/new', {
        templateUrl: 'app/features/org/partials/newOrg.html',
        controller : 'NewOrgCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/org/users', {
        templateUrl: 'app/features/org/partials/orgUsers.html',
        controller : 'OrgUsersCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/org/apikeys', {
        templateUrl: 'app/features/org/partials/orgApiKeys.html',
        controller : 'OrgApiKeysCtrl',
<<<<<<< dda08978836d7bcaa3f0bf6cde71161a86895386:public/app/core/routes/all.js
        resolve: loadOrgBundle,
=======
        resolve: new core.ModuleLoader("features/org/all"),
>>>>>>> tech(typescript): its looking good:public/app/routes/all.js
      })
      .when('/profile', {
        templateUrl: 'app/features/profile/partials/profile.html',
        controller : 'ProfileCtrl',
      })
      .when('/profile/password', {
        templateUrl: 'app/features/profile/partials/password.html',
        controller : 'ChangePasswordCtrl',
      })
      .when('/profile/select-org', {
        templateUrl: 'app/features/profile/partials/select_org.html',
        controller : 'SelectOrgCtrl',
      })
      .when('/admin/settings', {
        templateUrl: 'app/features/admin/partials/settings.html',
        controller : 'AdminSettingsCtrl',
      })
      .when('/admin/users', {
        templateUrl: 'app/features/admin/partials/users.html',
        controller : 'AdminListUsersCtrl',
      })
      .when('/admin/users/create', {
        templateUrl: 'app/features/admin/partials/new_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/admin/users/edit/:id', {
        templateUrl: 'app/features/admin/partials/edit_user.html',
        controller : 'AdminEditUserCtrl',
      })
      .when('/admin/orgs', {
        templateUrl: 'app/features/admin/partials/orgs.html',
        controller : 'AdminListOrgsCtrl',
      })
      .when('/admin/orgs/edit/:id', {
        templateUrl: 'app/features/admin/partials/edit_org.html',
        controller : 'AdminEditOrgCtrl',
      })
      .when('/login', {
        templateUrl: 'app/partials/login.html',
        controller : 'LoginCtrl',
      })
<<<<<<< e10a004f77a35c271848c113e6ad48ddcdccf129:public/app/core/routes/all.js
      .when('/invite/:code', {
        templateUrl: 'app/partials/signup_invited.html',
        controller : 'InvitedCtrl',
      })
      .when('/signup', {
        templateUrl: 'app/partials/signup_step2.html',
        controller : 'SignUpCtrl',
      })
=======
      .when('/signup/invited', {
        templateUrl: 'app/partials/signup_invited.html',
        controller : 'InvitedCtrl',
      })
>>>>>>> feat(invite): began work on invited signup view, also added backdrop to login view, #2353:public/app/routes/all.js
      .when('/user/password/send-reset-email', {
        templateUrl: 'app/partials/reset_password.html',
        controller : 'ResetPasswordCtrl',
      })
      .when('/user/password/reset', {
        templateUrl: 'app/partials/reset_password.html',
        controller : 'ResetPasswordCtrl',
      })
      .otherwise({
        templateUrl: 'app/partials/error.html',
        controller: 'ErrorCtrl'
      });
  });

});
