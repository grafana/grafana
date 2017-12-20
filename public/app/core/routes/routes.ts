import './dashboard_loaders';
import coreModule from 'app/core/core_module';

/** @ngInject **/
function setupAngularRoutes($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true);

  var loadOrgBundle = {
    lazy: [
      '$q',
      '$route',
      '$rootScope',
      ($q, $route, $rootScope) => {
        return System.import('app/features/org/all');
      },
    ],
  };

  var loadAdminBundle = {
    lazy: [
      '$q',
      '$route',
      '$rootScope',
      ($q, $route, $rootScope) => {
        return System.import('app/features/admin/admin');
      },
    ],
  };

  var loadAlertingBundle = {
    lazy: [
      '$q',
      '$route',
      '$rootScope',
      ($q, $route, $rootScope) => {
        return System.import('app/features/alerting/all');
      },
    ],
  };

  $routeProvider
    .when('/', {
      templateUrl: 'public/app/partials/dashboard.html',
      controller: 'LoadDashboardCtrl',
      reloadOnSearch: false,
      pageClass: 'page-dashboard',
    })
    .when('/dashboard/:type/:slug', {
      templateUrl: 'public/app/partials/dashboard.html',
      controller: 'LoadDashboardCtrl',
      reloadOnSearch: false,
      pageClass: 'page-dashboard',
    })
    .when('/dashboard-solo/:type/:slug', {
      templateUrl: 'public/app/features/panel/partials/soloPanel.html',
      controller: 'SoloPanelCtrl',
      reloadOnSearch: false,
      pageClass: 'page-dashboard',
    })
    .when('/dashboard/new', {
      templateUrl: 'public/app/partials/dashboard.html',
      controller: 'NewDashboardCtrl',
      reloadOnSearch: false,
      pageClass: 'page-dashboard',
    })
    .when('/dashboard/import', {
      templateUrl:
        'public/app/features/dashboard/partials/dashboard_import.html',
      controller: 'DashboardImportCtrl',
      controllerAs: 'ctrl',
    })
    .when('/datasources', {
      templateUrl: 'public/app/features/plugins/partials/ds_list.html',
      controller: 'DataSourcesCtrl',
      controllerAs: 'ctrl',
    })
    .when('/datasources/edit/:id', {
      templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
      controller: 'DataSourceEditCtrl',
      controllerAs: 'ctrl',
    })
    .when('/datasources/new', {
      templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
      controller: 'DataSourceEditCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards', {
      templateUrl: 'public/app/features/dashboard/partials/dashboard_list.html',
      controller: 'DashboardListCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards/folder/new', {
      templateUrl: 'public/app/features/dashboard/partials/create_folder.html',
      controller: 'CreateFolderCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards/folder/:folderId/:slug/permissions', {
      templateUrl:
        'public/app/features/dashboard/partials/folder_permissions.html',
      controller: 'FolderPermissionsCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards/folder/:folderId/:slug/settings', {
      templateUrl:
        'public/app/features/dashboard/partials/folder_settings.html',
      controller: 'FolderSettingsCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards/folder/:folderId/:slug', {
      templateUrl:
        'public/app/features/dashboard/partials/folder_dashboards.html',
      controller: 'FolderDashboardsCtrl',
      controllerAs: 'ctrl',
    })
    .when('/org', {
      templateUrl: 'public/app/features/org/partials/orgDetails.html',
      controller: 'OrgDetailsCtrl',
      resolve: loadOrgBundle,
    })
    .when('/org/new', {
      templateUrl: 'public/app/features/org/partials/newOrg.html',
      controller: 'NewOrgCtrl',
      resolve: loadOrgBundle,
    })
    .when('/org/users', {
      templateUrl: 'public/app/features/org/partials/orgUsers.html',
      controller: 'OrgUsersCtrl',
      controllerAs: 'ctrl',
      resolve: loadOrgBundle,
    })
    .when('/org/users/invite', {
      templateUrl: 'public/app/features/org/partials/invite.html',
      controller: 'UserInviteCtrl',
      controllerAs: 'ctrl',
      resolve: loadOrgBundle,
    })
    .when('/org/apikeys', {
      templateUrl: 'public/app/features/org/partials/orgApiKeys.html',
      controller: 'OrgApiKeysCtrl',
      resolve: loadOrgBundle,
    })
    .when('/org/teams', {
      templateUrl: 'public/app/features/org/partials/teams.html',
      controller: 'TeamsCtrl',
      controllerAs: 'ctrl',
      resolve: loadOrgBundle,
    })
    .when('/org/teams/edit/:id', {
      templateUrl: 'public/app/features/org/partials/team_details.html',
      controller: 'TeamDetailsCtrl',
      controllerAs: 'ctrl',
      resolve: loadOrgBundle,
    })
    .when('/profile', {
      templateUrl: 'public/app/features/org/partials/profile.html',
      controller: 'ProfileCtrl',
      controllerAs: 'ctrl',
      resolve: loadOrgBundle,
    })
    .when('/profile/password', {
      templateUrl: 'public/app/features/org/partials/change_password.html',
      controller: 'ChangePasswordCtrl',
      resolve: loadOrgBundle,
    })
    .when('/profile/select-org', {
      templateUrl: 'public/app/features/org/partials/select_org.html',
      controller: 'SelectOrgCtrl',
      resolve: loadOrgBundle,
    })
    // ADMIN
    .when('/admin', {
      templateUrl: 'public/app/features/admin/partials/admin_home.html',
      controller: 'AdminHomeCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/settings', {
      templateUrl: 'public/app/features/admin/partials/settings.html',
      controller: 'AdminSettingsCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/users', {
      templateUrl: 'public/app/features/admin/partials/users.html',
      controller: 'AdminListUsersCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/users/create', {
      templateUrl: 'public/app/features/admin/partials/new_user.html',
      controller: 'AdminEditUserCtrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/users/edit/:id', {
      templateUrl: 'public/app/features/admin/partials/edit_user.html',
      controller: 'AdminEditUserCtrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/orgs', {
      templateUrl: 'public/app/features/admin/partials/orgs.html',
      controller: 'AdminListOrgsCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/orgs/edit/:id', {
      templateUrl: 'public/app/features/admin/partials/edit_org.html',
      controller: 'AdminEditOrgCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    .when('/admin/stats', {
      templateUrl: 'public/app/features/admin/partials/stats.html',
      controller: 'AdminStatsCtrl',
      controllerAs: 'ctrl',
      resolve: loadAdminBundle,
    })
    // LOGIN / SIGNUP
    .when('/login', {
      templateUrl: 'public/app/partials/login.html',
      controller: 'LoginCtrl',
      pageClass: 'login-page sidemenu-hidden',
    })
    .when('/invite/:code', {
      templateUrl: 'public/app/partials/signup_invited.html',
      controller: 'InvitedCtrl',
      pageClass: 'sidemenu-hidden',
    })
    .when('/signup', {
      templateUrl: 'public/app/partials/signup_step2.html',
      controller: 'SignUpCtrl',
      pageClass: 'sidemenu-hidden',
    })
    .when('/user/password/send-reset-email', {
      templateUrl: 'public/app/partials/reset_password.html',
      controller: 'ResetPasswordCtrl',
      pageClass: 'sidemenu-hidden',
    })
    .when('/user/password/reset', {
      templateUrl: 'public/app/partials/reset_password.html',
      controller: 'ResetPasswordCtrl',
      pageClass: 'sidemenu-hidden',
    })
    .when('/dashboard/snapshots', {
      templateUrl: 'public/app/features/snapshot/partials/snapshots.html',
      controller: 'SnapshotsCtrl',
      controllerAs: 'ctrl',
    })
    .when('/plugins', {
      templateUrl: 'public/app/features/plugins/partials/plugin_list.html',
      controller: 'PluginListCtrl',
      controllerAs: 'ctrl',
    })
    .when('/plugins/:pluginId/edit', {
      templateUrl: 'public/app/features/plugins/partials/plugin_edit.html',
      controller: 'PluginEditCtrl',
      controllerAs: 'ctrl',
    })
    .when('/plugins/:pluginId/page/:slug', {
      templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
      controller: 'AppPageCtrl',
      controllerAs: 'ctrl',
    })
    .when('/styleguide/:page?', {
      controller: 'StyleGuideCtrl',
      controllerAs: 'ctrl',
      templateUrl: 'public/app/features/styleguide/styleguide.html',
    })
    .when('/alerting', {
      redirectTo: '/alerting/list',
    })
    .when('/alerting/list', {
      templateUrl: 'public/app/features/alerting/partials/alert_list.html',
      controller: 'AlertListCtrl',
      controllerAs: 'ctrl',
      resolve: loadAlertingBundle,
    })
    .when('/alerting/notifications', {
      templateUrl:
        'public/app/features/alerting/partials/notifications_list.html',
      controller: 'AlertNotificationsListCtrl',
      controllerAs: 'ctrl',
      resolve: loadAlertingBundle,
    })
    .when('/alerting/notification/new', {
      templateUrl:
        'public/app/features/alerting/partials/notification_edit.html',
      controller: 'AlertNotificationEditCtrl',
      controllerAs: 'ctrl',
      resolve: loadAlertingBundle,
    })
    .when('/alerting/notification/:id/edit', {
      templateUrl:
        'public/app/features/alerting/partials/notification_edit.html',
      controller: 'AlertNotificationEditCtrl',
      controllerAs: 'ctrl',
      resolve: loadAlertingBundle,
    })
    .otherwise({
      templateUrl: 'public/app/partials/error.html',
      controller: 'ErrorCtrl',
    });
}

coreModule.config(setupAngularRoutes);
