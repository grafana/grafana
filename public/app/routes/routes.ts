// import './dashboard_loaders';
import './ReactContainer';
import CreateFolderCtrl from 'app/features/folders/CreateFolderCtrl';
import FolderDashboardsCtrl from 'app/features/folders/FolderDashboardsCtrl';
import DashboardImportCtrl from 'app/features/manage-dashboards/DashboardImportCtrl';
// import LdapPage from 'app/features/admin/ldap/LdapPage';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import { SignupPage } from 'app/features/profile/SignupPage';
import { DashboardRouteInfo } from 'app/types';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { playlistRoutes } from '../features/playlist/playlist_routes';
import { RouteDescriptor } from '../core/navigation/types';
import { config } from '../core/config';

// const importDashboardPage = () =>
//   SafeDynamicImport(import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'));

export const routes: RouteDescriptor[] = [
  {
    path: '/',
    pageClass: 'page-dashboard',
    routeInfo: DashboardRouteInfo.Home,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
    ),
  },
  {
    path: '/d/:uid/:slug',
    pageClass: 'page-dashboard',
    routeInfo: DashboardRouteInfo.Normal,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
    ),
  },
  {
    path: '/d/:uid',
    pageClass: 'page-dashboard',
    reloadOnSearch: false,
    routeInfo: DashboardRouteInfo.Normal,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
    ),
  },
  {
    path: '/dashboard/:type/:slug',
    pageClass: 'page-dashboard',
    routeInfo: DashboardRouteInfo.Normal,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
    ),
  },
  {
    path: '/dashboard/new',
    pageClass: 'page-dashboard',
    routeInfo: DashboardRouteInfo.New,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
    ),
  },
  {
    path: '/d-solo/:uid/:slug',
    pageClass: 'dashboard-solo',
    routeInfo: DashboardRouteInfo.Normal,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
    ),
  },
  {
    path: '/d-solo/:uid',
    pageClass: 'dashboard-solo',
    routeInfo: DashboardRouteInfo.Normal,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
    ),
  },
  {
    path: '/dashboard-solo/:type/:slug',
    pageClass: 'dashboard-solo',
    routeInfo: DashboardRouteInfo.Normal,
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
    ),
  },
  {
    path: '/dashboard/import',
    templateUrl: 'public/app/features/manage-dashboards/partials/dashboard_import.html',
    controller: DashboardImportCtrl,
    controllerAs: 'ctrl',
  },
  {
    path: '/datasources',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DataSourcesListPage"*/ 'app/features/datasources/DataSourcesListPage')
    ),
  },
  {
    path: '/datasources/edit/:id/',
    reloadOnSearch: false, // for tabs
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DataSourceSettingsPage"*/ '../features/datasources/settings/DataSourceSettingsPage')
    ),
  },
  {
    path: '/datasources/edit/:id/dashboards',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DataSourceDashboards"*/ 'app/features/datasources/DataSourceDashboards')
    ),
  },
  {
    path: '/datasources/new',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NewDataSourcePage"*/ '../features/datasources/NewDataSourcePage')
    ),
  },
  {
    path: '/dashboards',
    templateUrl: 'public/app/features/manage-dashboards/partials/dashboard_list.html',
    controller: 'DashboardListCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/dashboards/folder/new',
    templateUrl: 'public/app/features/folders/partials/create_folder.html',
    controller: CreateFolderCtrl,
    controllerAs: 'ctrl',
  },
  {
    path: '/dashboards/f/:uid/:slug/permissions',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/FolderPermissions')
    ),
  },
  {
    path: '/dashboards/f/:uid/:slug/settings',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "FolderSettingsPage"*/ 'app/features/folders/FolderSettingsPage')
    ),
  },
  {
    path: '/dashboards/f/:uid/:slug',
    templateUrl: 'public/app/features/folders/partials/folder_dashboards.html',
    controller: FolderDashboardsCtrl,
    controllerAs: 'ctrl',
  },
  {
    path: '/dashboards/f/:uid',
    templateUrl: 'public/app/features/folders/partials/folder_dashboards.html',
    controller: FolderDashboardsCtrl,
    controllerAs: 'ctrl',
  },
  {
    path: '/explore',

    reloadOnSearch: false,
    // TODO
    roles: () => (config.viewersCanEdit ? [] : ['Editor', 'Admin']),
    component: SafeDynamicImport(import(/* webpackChunkName: "explore" */ 'app/features/explore/Wrapper')),
  },
  {
    path: '/a/:pluginId/',
    // Someday * and will get a ReactRouter under that path!
    reloadOnSearch: false,
    component: SafeDynamicImport(import(/* webpackChunkName: "AppRootPage" */ 'app/features/plugins/AppRootPage')),
  },
  {
    path: '/org',
    component: SafeDynamicImport(import(/* webpackChunkName: "OrgDetailsPage" */ '../features/org/OrgDetailsPage')),
  },
  {
    path: '/org/new',
    templateUrl: 'public/app/features/org/partials/newOrg.html',
    controller: 'NewOrgCtrl',
  },
  {
    path: '/org/users',
    component: SafeDynamicImport(import(/* webpackChunkName: "UsersListPage" */ 'app/features/users/UsersListPage')),
  },
  {
    path: '/org/users/invite',
    component: SafeDynamicImport(import(/* webpackChunkName: "UserInvitePage" */ 'app/features/org/UserInvitePage')),
  },
  // TODO[Router]: resolve roles
  {
    path: '/org/apikeys',
    roles: () => ['Editor', 'Admin'],
    component: SafeDynamicImport(import(/* webpackChunkName: "ApiKeysPage" */ 'app/features/api-keys/ApiKeysPage')),
  },
  // TODO[Router]: resolve roles
  // {
  //   path: '/org/teams',
  //
  //   resolve: {
  //     roles: () => (config.editorsCanAdmin ? [] : ['Editor', 'Admin']),
  //     component: () => SafeDynamicImport(import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList')),
  //   },
  // },
  // TODO[Router]: resolve roles
  // {
  //   path: '/org/teams/new',
  //
  //   resolve: {
  //     roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
  //     component: () =>
  //       SafeDynamicImport(import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam')),
  //   },
  // },
  // TODO[Router]: resolve roles
  // {
  //   path: '/org/teams/edit/:id/:page?',
  //
  //   resolve: {
  //     roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
  //     component: () => SafeDynamicImport(import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages')),
  //   },
  // },
  {
    path: '/profile',
    templateUrl: 'public/app/features/profile/partials/profile.html',
    controller: 'ProfileCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/profile/password',
    component: SafeDynamicImport(
      import(/* webPackChunkName: "ChangePasswordPage" */ 'app/features/profile/ChangePasswordPage')
    ),
  },
  {
    path: '/profile/select-org',
    templateUrl: 'public/app/features/org/partials/select_org.html',
    controller: 'SelectOrgCtrl',
  },
  // ADMIN
  {
    path: '/admin',
    templateUrl: 'public/app/features/admin/partials/admin_home.html',
    controller: 'AdminHomeCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/admin/settings',
    component: SafeDynamicImport(import(/* webpackChunkName: "AdminSettings" */ 'app/features/admin/AdminSettings')),
  },
  {
    path: '/admin/upgrading',
    component: SafeDynamicImport(import('app/features/admin/UpgradePage')),
  },
  {
    path: '/admin/users',
    templateUrl: 'public/app/features/admin/partials/users.html',
    controller: 'AdminListUsersCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/admin/users/create',
    component: SafeDynamicImport(import(/* webpackChunkName: "UserCreatePage" */ 'app/features/admin/UserCreatePage')),
  },
  {
    path: '/admin/users/edit/:id',
    component: UserAdminPage,
  },
  {
    path: '/admin/orgs',
    templateUrl: 'public/app/features/admin/partials/orgs.html',
    controller: 'AdminListOrgsCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/admin/orgs/edit/:id',
    templateUrl: 'public/app/features/admin/partials/edit_org.html',
    controller: 'AdminEditOrgCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/admin/stats',
    component: SafeDynamicImport(import(/* webpackChunkName: "ServerStats" */ 'app/features/admin/ServerStats')),
  },
  // TODO[Router]
  // {
  //   path: '/admin/ldap',
  //   component: LdapPage,
  // },
  // LOGIN / SIGNUP
  {
    path: '/login',
    component: LoginPage,
    pageClass: 'login-page sidemenu-hidden',
  },
  {
    path: '/invite/:code',
    component: SafeDynamicImport(import(/* webpackChunkName: "SignupInvited" */ 'app/features/users/SignupInvited')),
    pageClass: 'sidemenu-hidden',
  },
  {
    path: '/signup',
    component: SignupPage,
    pageClass: 'sidemenu-hidden',
  },
  {
    path: '/user/password/send-reset-email',
    templateUrl: 'public/app/partials/reset_password.html',
    controller: 'ResetPasswordCtrl',
    pageClass: 'sidemenu-hidden',
  },
  {
    path: '/user/password/reset',
    templateUrl: 'public/app/partials/reset_password.html',
    controller: 'ResetPasswordCtrl',
    pageClass: 'sidemenu-hidden',
  },
  {
    path: '/dashboard/snapshots',
    templateUrl: 'public/app/features/manage-dashboards/partials/snapshot_list.html',
    controller: 'SnapshotListCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/plugins',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "PluginListPage" */ 'app/features/plugins/PluginListPage')
    ),
  },
  {
    path: '/plugins/:pluginId/',
    reloadOnSearch: false, // tabs from query parameters
    component: SafeDynamicImport(import(/* webpackChunkName: "PluginPage" */ '../features/plugins/PluginPage')),
  },
  {
    path: '/plugins/:pluginId/page/:slug',
    templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
    controller: 'AppPageCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/alerting',
    redirectTo: '/alerting/list',
  },
  {
    path: '/alerting/list',
    reloadOnSearch: false,
    component: SafeDynamicImport(import(/* webpackChunkName: "AlertRuleList" */ 'app/features/alerting/AlertRuleList')),
  },
  {
    path: '/alerting/notifications',
    templateUrl: 'public/app/features/alerting/partials/notifications_list.html',
    controller: 'AlertNotificationsListCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/alerting/notification/new',
    templateUrl: 'public/app/features/alerting/partials/notification_edit.html',
    controller: 'AlertNotificationEditCtrl',
    controllerAs: 'ctrl',
  },
  {
    path: '/alerting/notification/:id/edit',
    templateUrl: 'public/app/features/alerting/partials/notification_edit.html',
    controller: 'AlertNotificationEditCtrl',
    controllerAs: 'ctrl',
  },
  ...playlistRoutes,
];
