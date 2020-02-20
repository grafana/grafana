import './dashboard_loaders';
import './ReactContainer';
import { applyRouteRegistrationHandlers } from './registry';
// Pages
import CreateFolderCtrl from 'app/features/folders/CreateFolderCtrl';
import FolderDashboardsCtrl from 'app/features/folders/FolderDashboardsCtrl';
import DashboardImportCtrl from 'app/features/manage-dashboards/DashboardImportCtrl';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import SignupPage from 'app/features/profile/SignupPage';

import config from 'app/core/config';
import { ILocationProvider, route } from 'angular';
// Types
import { DashboardRouteInfo } from 'app/types';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';

/** @ngInject */
export function setupAngularRoutes($routeProvider: route.IRouteProvider, $locationProvider: ILocationProvider) {
  $locationProvider.html5Mode(true);

  // Routes here are guarded both here and server side for react-container routes or just on the server for angular
  // ones. That means angular ones could be navigated to in case there is a client side link some where.

  const importDashboardPage = () =>
    SafeDynamicImport(import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'));

  $routeProvider
    .when('/', {
      template: '<react-container />',
      //@ts-ignore
      pageClass: 'page-dashboard',
      routeInfo: DashboardRouteInfo.Home,
      reloadOnSearch: false,
      resolve: {
        component: importDashboardPage,
      },
    })
    .when('/d/:uid/:slug', {
      template: '<react-container />',
      pageClass: 'page-dashboard',
      routeInfo: DashboardRouteInfo.Normal,
      reloadOnSearch: false,
      resolve: {
        component: importDashboardPage,
      },
    })
    .when('/d/:uid', {
      template: '<react-container />',
      pageClass: 'page-dashboard',
      reloadOnSearch: false,
      routeInfo: DashboardRouteInfo.Normal,
      resolve: {
        component: importDashboardPage,
      },
    })
    .when('/dashboard/:type/:slug', {
      template: '<react-container />',
      pageClass: 'page-dashboard',
      routeInfo: DashboardRouteInfo.Normal,
      reloadOnSearch: false,
      resolve: {
        component: importDashboardPage,
      },
    })
    .when('/dashboard/new', {
      template: '<react-container />',
      pageClass: 'page-dashboard',
      routeInfo: DashboardRouteInfo.New,
      reloadOnSearch: false,
      resolve: {
        component: importDashboardPage,
      },
    })
    .when('/d-solo/:uid/:slug', {
      template: '<react-container />',
      pageClass: 'dashboard-solo',
      routeInfo: DashboardRouteInfo.Normal,
      reloadOnSearch: false,
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
          ),
      },
    })
    .when('/d-solo/:uid', {
      template: '<react-container />',
      pageClass: 'dashboard-solo',
      routeInfo: DashboardRouteInfo.Normal,
      reloadOnSearch: false,
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
          ),
      },
    })
    .when('/dashboard-solo/:type/:slug', {
      template: '<react-container />',
      pageClass: 'dashboard-solo',
      routeInfo: DashboardRouteInfo.Normal,
      reloadOnSearch: false,
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
          ),
      },
    })
    .when('/dashboard/import', {
      templateUrl: 'public/app/features/manage-dashboards/partials/dashboard_import.html',
      controller: DashboardImportCtrl,
      controllerAs: 'ctrl',
    })
    .when('/datasources', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "DataSourcesListPage"*/ 'app/features/datasources/DataSourcesListPage')
          ),
      },
    })
    .when('/datasources/edit/:id/', {
      template: '<react-container />',
      reloadOnSearch: false, // for tabs
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(
              /* webpackChunkName: "DataSourceSettingsPage"*/ '../features/datasources/settings/DataSourceSettingsPage'
            )
          ),
      },
    })
    .when('/datasources/edit/:id/dashboards', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "DataSourceDashboards"*/ 'app/features/datasources/DataSourceDashboards')
          ),
      },
    })
    .when('/datasources/new', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "NewDataSourcePage"*/ '../features/datasources/NewDataSourcePage')
          ),
      },
    })
    .when('/dashboards', {
      templateUrl: 'public/app/features/manage-dashboards/partials/dashboard_list.html',
      controller: 'DashboardListCtrl',
      controllerAs: 'ctrl',
    })
    .when('/dashboards/folder/new', {
      templateUrl: 'public/app/features/folders/partials/create_folder.html',
      controller: CreateFolderCtrl,
      controllerAs: 'ctrl',
    })
    .when('/dashboards/f/:uid/:slug/permissions', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/FolderPermissions')
          ),
      },
    })
    .when('/dashboards/f/:uid/:slug/settings', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webpackChunkName: "FolderSettingsPage"*/ 'app/features/folders/FolderSettingsPage')
          ),
      },
    })
    .when('/dashboards/f/:uid/:slug', {
      templateUrl: 'public/app/features/folders/partials/folder_dashboards.html',
      controller: FolderDashboardsCtrl,
      controllerAs: 'ctrl',
    })
    .when('/dashboards/f/:uid', {
      templateUrl: 'public/app/features/folders/partials/folder_dashboards.html',
      controller: FolderDashboardsCtrl,
      controllerAs: 'ctrl',
    })
    .when('/explore', {
      template: '<react-container />',
      reloadOnSearch: false,
      resolve: {
        roles: () => (config.viewersCanEdit ? [] : ['Editor', 'Admin']),
        component: () => SafeDynamicImport(import(/* webpackChunkName: "explore" */ 'app/features/explore/Wrapper')),
      },
    })
    .when('/a/:pluginId/', {
      // Someday * and will get a ReactRouter under that path!
      template: '<react-container />',
      reloadOnSearch: false,
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "AppRootPage" */ 'app/features/plugins/AppRootPage')),
      },
    })
    .when('/org', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "OrgDetailsPage" */ '../features/org/OrgDetailsPage')),
      },
    })
    .when('/org/new', {
      templateUrl: 'public/app/features/org/partials/newOrg.html',
      controller: 'NewOrgCtrl',
    })
    .when('/org/users', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "UsersListPage" */ 'app/features/users/UsersListPage')),
      },
    })
    .when('/org/users/invite', {
      template: '<react-container/>',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "UserInvitePage" */ 'app/features/org/UserInvitePage')),
      },
    })
    .when('/org/apikeys', {
      template: '<react-container />',
      resolve: {
        roles: () => ['Editor', 'Admin'],
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "ApiKeysPage" */ 'app/features/api-keys/ApiKeysPage')),
      },
    })
    .when('/org/teams', {
      template: '<react-container />',
      resolve: {
        roles: () => (config.editorsCanAdmin ? [] : ['Editor', 'Admin']),
        component: () => SafeDynamicImport(import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList')),
      },
    })
    .when('/org/teams/new', {
      template: '<react-container />',
      resolve: {
        roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam')),
      },
    })
    .when('/org/teams/edit/:id/:page?', {
      template: '<react-container />',
      resolve: {
        roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
        component: () => SafeDynamicImport(import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages')),
      },
    })
    .when('/profile', {
      templateUrl: 'public/app/features/profile/partials/profile.html',
      controller: 'ProfileCtrl',
      controllerAs: 'ctrl',
    })
    .when('/profile/password', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(
            import(/* webPackChunkName: "ChangePasswordPage" */ 'app/features/profile/ChangePasswordPage')
          ),
      },
    })
    .when('/profile/select-org', {
      templateUrl: 'public/app/features/org/partials/select_org.html',
      controller: 'SelectOrgCtrl',
    })
    // ADMIN
    .when('/admin', {
      templateUrl: 'public/app/features/admin/partials/admin_home.html',
      controller: 'AdminHomeCtrl',
      controllerAs: 'ctrl',
    })
    .when('/admin/settings', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "AdminSettings" */ 'app/features/admin/AdminSettings')),
      },
    })
    .when('/admin/upgrading', {
      template: '<react-container />',
      resolve: {
        component: () => SafeDynamicImport(import('app/features/admin/UpgradePage')),
      },
    })
    .when('/admin/users', {
      templateUrl: 'public/app/features/admin/partials/users.html',
      controller: 'AdminListUsersCtrl',
      controllerAs: 'ctrl',
    })
    .when('/admin/users/create', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "UserCreatePage" */ 'app/features/admin/UserCreatePage')),
      },
    })
    .when('/admin/users/edit/:id', {
      template: '<react-container />',
      resolve: {
        component: () => UserAdminPage,
      },
    })
    .when('/admin/orgs', {
      templateUrl: 'public/app/features/admin/partials/orgs.html',
      controller: 'AdminListOrgsCtrl',
      controllerAs: 'ctrl',
    })
    .when('/admin/orgs/edit/:id', {
      templateUrl: 'public/app/features/admin/partials/edit_org.html',
      controller: 'AdminEditOrgCtrl',
      controllerAs: 'ctrl',
    })
    .when('/admin/stats', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "ServerStats" */ 'app/features/admin/ServerStats')),
      },
    })
    .when('/admin/ldap', {
      template: '<react-container />',
      resolve: {
        component: () => LdapPage,
      },
    })
    // LOGIN / SIGNUP
    .when('/login', {
      template: '<react-container/>',
      resolve: {
        component: () => LoginPage,
      },
      pageClass: 'login-page sidemenu-hidden',
    })
    .when('/invite/:code', {
      templateUrl: 'public/app/partials/signup_invited.html',
      controller: 'InvitedCtrl',
      pageClass: 'sidemenu-hidden',
    })
    .when('/signup', {
      template: '<react-container/>',
      resolve: {
        component: () => SignupPage,
      },
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
      templateUrl: 'public/app/features/manage-dashboards/partials/snapshot_list.html',
      controller: 'SnapshotListCtrl',
      controllerAs: 'ctrl',
    })
    .when('/plugins', {
      template: '<react-container />',
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "PluginListPage" */ 'app/features/plugins/PluginListPage')),
      },
    })
    .when('/plugins/:pluginId/', {
      template: '<react-container />',
      reloadOnSearch: false, // tabs from query parameters
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "PluginPage" */ '../features/plugins/PluginPage')),
      },
    })
    .when('/plugins/:pluginId/page/:slug', {
      templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
      controller: 'AppPageCtrl',
      controllerAs: 'ctrl',
    })
    .when('/alerting', {
      redirectTo: '/alerting/list',
    })
    .when('/alerting/list', {
      template: '<react-container />',
      reloadOnSearch: false,
      resolve: {
        component: () =>
          SafeDynamicImport(import(/* webpackChunkName: "AlertRuleList" */ 'app/features/alerting/AlertRuleList')),
      },
    })
    .when('/alerting/notifications', {
      templateUrl: 'public/app/features/alerting/partials/notifications_list.html',
      controller: 'AlertNotificationsListCtrl',
      controllerAs: 'ctrl',
    })
    .when('/alerting/notification/new', {
      templateUrl: 'public/app/features/alerting/partials/notification_edit.html',
      controller: 'AlertNotificationEditCtrl',
      controllerAs: 'ctrl',
    })
    .when('/alerting/notification/:id/edit', {
      templateUrl: 'public/app/features/alerting/partials/notification_edit.html',
      controller: 'AlertNotificationEditCtrl',
      controllerAs: 'ctrl',
    })
    .otherwise({
      templateUrl: 'public/app/partials/error.html',
      controller: 'ErrorCtrl',
    });

  applyRouteRegistrationHandlers($routeProvider);
}
