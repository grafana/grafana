// import './dashboard_loaders';
import './ReactContainer';

// import { applyRouteRegistrationHandlers } from './registry';
// import { contextSrv } from 'app/core/services/context_srv';

// Pages
// import LdapPage from 'app/features/admin/ldap/LdapPage';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import { LoginPage } from 'app/core/components/Login/LoginPage';

import config from 'app/core/config';
// Types

import { DashboardRouteInfo } from 'app/types';
import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { playlistRoutes } from '../features/playlist/playlist_routes';
import { RouteDescriptor } from '../core/navigation/types';
import { SignupPage } from 'app/core/components/Signup/SignupPage';

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
    // TODO[Router]
    //roles: () => (contextSrv.hasEditPermissionInFolders ? [contextSrv.user.orgRole] : ['Admin']),
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
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardImport"*/ 'app/features/manage-dashboards/DashboardImportPage')
    ),
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
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
    ),
  },
  {
    path: '/dashboards/folder/new',
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NewDashboardsFolder"*/ 'app/features/folders/components/NewDashboardsFolder')
    ),
  },
  {
    path: '/dashboards/f/:uid/:slug/permissions',
    reloadOnSearch: false, // for tabs
    component: SafeDynamicImport(
      import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/FolderPermissions')
    ),
  },
  {
    path: '/dashboards/f/:uid/:slug/settings',
    reloadOnSearch: false, // for tabs
    component: SafeDynamicImport(
      import(/* webpackChunkName: "FolderSettingsPage"*/ 'app/features/folders/FolderSettingsPage')
    ),
  },
  {
    path: '/dashboards/f/:uid/:slug',
    reloadOnSearch: false, // for tabs
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
    ),
  },
  {
    path: '/dashboards/f/:uid',
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
    ),
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
    reloadOnSearch: false,
    component: SafeDynamicImport(import(/* webpackChunkName: "NewOrgPage" */ 'app/features/org/NewOrgPage')),
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
    component: SafeDynamicImport(
      import(/* webpackChunkName: "UserProfileEdit" */ 'app/features/profile/UserProfileEdit')
    ),
  },
  {
    path: '/profile/password',
    component: SafeDynamicImport(
      import(/* webPackChunkName: "ChangePasswordPage" */ 'app/features/profile/ChangePasswordPage')
    ),
  },
  {
    path: '/profile/select-org',
    component: SafeDynamicImport(import(/* webpackChunkName: "SelectOrgPage" */ 'app/features/org/SelectOrgPage')),
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
    component: SafeDynamicImport(
      import(/* webpackChunkName: "UserListAdminPage" */ 'app/features/admin/UserListAdminPage')
    ),
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
    component: SafeDynamicImport(
      import(/* webpackChunkName: "AdminListOrgsPage" */ 'app/features/admin/AdminListOrgsPage')
    ),
  },
  {
    path: '/admin/orgs/edit/:id',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "AdminEditOrgPage" */ 'app/features/admin/AdminEditOrgPage')
    ),
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
    pageClass: 'sidemenu-hidden login-page',
  },
  {
    path: '/user/password/send-reset-email',
    pageClass: 'sidemenu-hidden',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "SendResetMailPage" */ 'app/core/components/ForgottenPassword/SendResetMailPage')
    ),
  },
  {
    path: '/user/password/reset',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "ChangePasswordPage" */ 'app/core/components/ForgottenPassword/ChangePasswordPage')
    ),
    pageClass: 'sidemenu-hidden login-page',
  },
  {
    path: '/dashboard/snapshots',
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "SnapshotListPage" */ 'app/features/manage-dashboards/SnapshotListPage')
    ),
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
    reloadOnSearch: false,
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsListPage')
    ),
  },
  {
    path: '/alerting/notification/new',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NewNotificationChannel" */ 'app/features/alerting/NewNotificationChannelPage')
    ),
  },
  {
    path: '/alerting/notification/:id/edit',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "EditNotificationChannel"*/ 'app/features/alerting/EditNotificationChannelPage')
    ),
  },
  {
    path: 'alerting/new',
    pageClass: 'page-alerting',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NgAlertingPage"*/ 'app/features/alerting/NextGenAlertingPage')
    ),
  },
  {
    path: 'alerting/:id/edit',
    pageClass: 'page-alerting',
    component: SafeDynamicImport(
      import(/* webpackChunkName: "NgAlertingPage"*/ 'app/features/alerting/NextGenAlertingPage')
    ),
  },
  ...playlistRoutes,
];
