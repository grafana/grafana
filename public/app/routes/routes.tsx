import React from 'react';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import config from 'app/core/config';
import { DashboardRoutes } from 'app/types';
import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from '../core/navigation/types';
import { SignupPage } from 'app/core/components/Signup/SignupPage';
import { Redirect } from 'react-router-dom';
import ErrorPage from 'app/core/components/ErrorPage/ErrorPage';

export const extraRoutes: RouteDescriptor[] = [];

export function getAppRoutes(): RouteDescriptor[] {
  return [
    {
      path: '/',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Home,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
      ),
    },
    {
      path: '/d/:uid/:slug?',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
      ),
    },
    {
      path: '/dashboard/:type/:slug',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
      ),
    },
    {
      path: '/dashboard/new',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.New,
      // TODO[Router]
      //roles: () => (contextSrv.hasEditPermissionInFolders ? [contextSrv.user.orgRole] : ['Admin']),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage')
      ),
    },
    {
      path: '/d-solo/:uid/:slug',
      pageClass: 'dashboard-solo',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    {
      path: '/d-solo/:uid',
      pageClass: 'dashboard-solo',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    {
      path: '/dashboard/import',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardImport"*/ 'app/features/manage-dashboards/DashboardImportPage')
      ),
    },
    {
      path: '/datasources',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DataSourcesListPage"*/ 'app/features/datasources/DataSourcesListPage')
      ),
    },
    {
      path: '/datasources/edit/:uid/',
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "DataSourceSettingsPage"*/ '../features/datasources/settings/DataSourceSettingsPage'
          )
      ),
    },
    {
      path: '/datasources/edit/:uid/dashboards',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DataSourceDashboards"*/ 'app/features/datasources/DataSourceDashboards')
      ),
    },
    {
      path: '/datasources/new',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NewDataSourcePage"*/ '../features/datasources/NewDataSourcePage')
      ),
    },
    {
      path: '/dashboards',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
      ),
    },
    {
      path: '/dashboards/folder/new',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NewDashboardsFolder"*/ 'app/features/folders/components/NewDashboardsFolder')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/permissions',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/FolderPermissions')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/settings',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderSettingsPage"*/ 'app/features/folders/FolderSettingsPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
      ),
    },
    {
      path: '/dashboards/f/:uid',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
      ),
    },
    {
      path: '/explore',
      pageClass: 'page-explore',
      roles: () => (config.viewersCanEdit ? [] : ['Editor', 'Admin']),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "explore" */ 'app/features/explore/Wrapper')),
    },
    {
      path: '/a/:pluginId/',
      exact: false,
      // Someday * and will get a ReactRouter under that path!
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AppRootPage" */ 'app/features/plugins/AppRootPage')
      ),
    },
    {
      path: '/org',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "OrgDetailsPage" */ '../features/org/OrgDetailsPage')
      ),
    },
    {
      path: '/org/new',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "NewOrgPage" */ 'app/features/org/NewOrgPage')),
    },
    {
      path: '/org/users',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UsersListPage" */ 'app/features/users/UsersListPage')
      ),
    },
    {
      path: '/org/users/invite',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserInvitePage" */ 'app/features/org/UserInvitePage')
      ),
    },
    {
      path: '/org/apikeys',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ApiKeysPage" */ 'app/features/api-keys/ApiKeysPage')
      ),
    },
    {
      path: '/org/teams',
      roles: () => (config.editorsCanAdmin ? [] : ['Editor', 'Admin']),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList')),
    },
    {
      path: '/org/teams/new',

      roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam')),
    },
    {
      path: '/org/teams/edit/:id/:page?',
      roles: () => (config.editorsCanAdmin ? [] : ['Admin']),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages')),
    },
    {
      path: '/profile',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserProfileEditPage" */ 'app/features/profile/UserProfileEditPage')
      ),
    },
    {
      path: '/profile/password',
      component: SafeDynamicImport(
        () => import(/* webPackChunkName: "ChangePasswordPage" */ 'app/features/profile/ChangePasswordPage')
      ),
    },
    {
      path: '/profile/select-org',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SelectOrgPage" */ 'app/features/org/SelectOrgPage')
      ),
    },
    // ADMIN

    {
      path: '/admin',
      // eslint-disable-next-line react/display-name
      component: () => <Redirect to="/admin/users" />,
    },
    {
      path: '/admin/settings',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AdminSettings" */ 'app/features/admin/AdminSettings')
      ),
    },
    {
      path: '/admin/upgrading',
      component: SafeDynamicImport(() => import('app/features/admin/UpgradePage')),
    },
    {
      path: '/admin/users',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserListAdminPage" */ 'app/features/admin/UserListAdminPage')
      ),
    },
    {
      path: '/admin/users/create',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserCreatePage" */ 'app/features/admin/UserCreatePage')
      ),
    },
    {
      path: '/admin/users/edit/:id',
      component: UserAdminPage,
    },
    {
      path: '/admin/orgs',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AdminListOrgsPage" */ 'app/features/admin/AdminListOrgsPage')
      ),
    },
    {
      path: '/admin/orgs/edit/:id',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AdminEditOrgPage" */ 'app/features/admin/AdminEditOrgPage')
      ),
    },
    {
      path: '/admin/stats',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ServerStats" */ 'app/features/admin/ServerStats')
      ),
    },
    {
      path: '/admin/ldap',
      component: LdapPage,
    },
    // LOGIN / SIGNUP
    {
      path: '/login',
      component: LoginPage,
      pageClass: 'login-page sidemenu-hidden',
    },
    {
      path: '/invite/:code',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SignupInvited" */ 'app/features/users/SignupInvited')
      ),
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
        () =>
          import(/* webpackChunkName: "SendResetMailPage" */ 'app/core/components/ForgottenPassword/SendResetMailPage')
      ),
    },
    {
      path: '/user/password/reset',
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "ChangePasswordPage" */ 'app/core/components/ForgottenPassword/ChangePasswordPage'
          )
      ),
      pageClass: 'sidemenu-hidden login-page',
    },
    {
      path: '/dashboard/snapshots',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SnapshotListPage" */ 'app/features/manage-dashboards/SnapshotListPage')
      ),
    },
    {
      path: '/plugins',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "PluginListPage" */ 'app/features/plugins/PluginListPage')
      ),
    },
    {
      path: '/plugins/:pluginId/',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "PluginPage" */ '../features/plugins/PluginPage')),
    },
    // TODO[Router]
    // {
    //   path: '/plugins/:pluginId/page/:slug',
    //   templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
    //   controller: 'AppPageCtrl',
    //   controllerAs: 'ctrl',
    // },
    {
      path: '/alerting',
      // eslint-disable-next-line react/display-name
      component: () => <Redirect to="/alerting/list" />,
    },
    {
      path: '/alerting/list',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertRuleListIndex" */ 'app/features/alerting/AlertRuleListIndex')
      ),
    },
    {
      path: '/alerting/ng/list',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertRuleList" */ 'app/features/alerting/AlertRuleList')
      ),
    },
    {
      path: '/alerting/routes',
      roles: () => ['Admin', 'Editor'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertAmRoutes" */ 'app/features/alerting/unified/AmRoutes')
      ),
    },
    {
      path: '/alerting/silences',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences')
      ),
    },
    {
      path: '/alerting/silence/new',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences')
      ),
    },
    {
      path: '/alerting/silence/:id/edit',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences')
      ),
    },
    {
      path: '/alerting/notifications',
      roles: config.featureToggles.ngalert ? () => ['Editor', 'Admin'] : undefined,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notifications/templates/new',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notifications/templates/:id/edit',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notifications/receivers/new',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notifications/receivers/:id/edit',
      roles: () => ['Editor', 'Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notifications/global-config',
      roles: () => ['Admin', 'Editor'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex')
      ),
    },
    {
      path: '/alerting/notification/new',
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "NewNotificationChannel" */ 'app/features/alerting/NewNotificationChannelPage')
      ),
    },
    {
      path: '/alerting/notification/:id/edit',
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "EditNotificationChannel"*/ 'app/features/alerting/EditNotificationChannelPage')
      ),
    },
    {
      path: '/alerting/new',
      pageClass: 'page-alerting',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor')
      ),
    },
    {
      path: '/alerting/:id/edit',
      pageClass: 'page-alerting',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor')
      ),
    },
    {
      path: '/playlists',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "PlaylistPage"*/ 'app/features/playlist/PlaylistPage')
      ),
    },
    {
      path: '/playlists/play/:id',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "PlaylistStartPage"*/ 'app/features/playlist/PlaylistStartPage')
      ),
    },
    {
      path: '/playlists/new',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "PlaylistNewPage"*/ 'app/features/playlist/PlaylistNewPage')
      ),
    },
    {
      path: '/playlists/edit/:id',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "PlaylistEditPage"*/ 'app/features/playlist/PlaylistEditPage')
      ),
    },
    {
      path: '/sandbox/benchmarks',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "BenchmarksPage"*/ 'app/features/sandbox/BenchmarksPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/library-panels',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderLibraryPanelsPage"*/ 'app/features/folders/FolderLibraryPanelsPage')
      ),
    },
    {
      path: '/library-panels',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "LibraryPanelsPage"*/ 'app/features/library-panels/LibraryPanelsPage')
      ),
    },
    ...extraRoutes,
    {
      path: '/*',
      component: ErrorPage,
    },

    // TODO[Router]
    // ...playlistRoutes,
  ];
}
