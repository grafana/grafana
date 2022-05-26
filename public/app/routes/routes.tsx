import React from 'react';
import { Redirect } from 'react-router-dom';

import ErrorPage from 'app/core/components/ErrorPage/ErrorPage';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import { getAlertingRoutes } from 'app/features/alerting/routes';
import { getLiveRoutes } from 'app/features/live/pages/routes';
import { getRoutes as getPluginCatalogRoutes } from 'app/features/plugins/admin/routes';
import { getProfileRoutes } from 'app/features/profile/routes';
import { ServiceAccountPage } from 'app/features/serviceaccounts/ServiceAccountPage';
import { AccessControlAction, DashboardRoutes } from 'app/types';

import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from '../core/navigation/types';

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
    // This route handles embedding of snapshot/scripted dashboard panels
    {
      path: '/dashboard-solo/:type/:slug',
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
      component:
        config.rbacEnabled && contextSrv.hasPermission(AccessControlAction.FoldersPermissionsRead)
          ? SafeDynamicImport(
              () =>
                import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/AccessControlFolderPermissions')
            )
          : SafeDynamicImport(
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
      roles: () =>
        contextSrv.evaluatePermission(
          () => (config.viewersCanEdit ? [] : ['Editor', 'Admin']),
          [AccessControlAction.DataSourcesExplore]
        ),
      component: SafeDynamicImport(() =>
        config.exploreEnabled
          ? import(/* webpackChunkName: "explore" */ 'app/features/explore/Wrapper')
          : import(/* webpackChunkName: "explore-feature-toggle-page" */ 'app/features/explore/FeatureTogglePage')
      ),
    },
    {
      path: '/a/:pluginId/',
      exact: false,
      // Someday * and will get a ReactRouter under that path!
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AppRootPage" */ 'app/features/plugins/components/AppRootPage')
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
      roles: () => contextSrv.evaluatePermission(() => ['Admin'], [AccessControlAction.ActionAPIKeysRead]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ApiKeysPage" */ 'app/features/api-keys/ApiKeysPage')
      ),
    },
    {
      path: '/org/serviceaccounts',
      roles: () => contextSrv.evaluatePermission(() => ['Admin'], [AccessControlAction.ServiceAccountsRead]),
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "ServiceAccountsPage" */ 'app/features/serviceaccounts/ServiceAccountsListPage')
      ),
    },
    {
      path: '/org/serviceaccounts/create',
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "ServiceAccountCreatePage" */ 'app/features/serviceaccounts/ServiceAccountCreatePage'
          )
      ),
    },
    {
      path: '/org/serviceaccounts/:id',
      component: ServiceAccountPage,
    },
    {
      path: '/org/teams',
      roles: () =>
        contextSrv.evaluatePermission(
          () => (config.editorsCanAdmin ? ['Editor', 'Admin'] : ['Admin']),
          [AccessControlAction.ActionTeamsRead, AccessControlAction.ActionTeamsCreate]
        ),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList')),
    },
    {
      path: '/org/teams/new',
      roles: () =>
        contextSrv.evaluatePermission(
          () => (config.editorsCanAdmin ? ['Editor', 'Admin'] : ['Admin']),
          [AccessControlAction.ActionTeamsCreate]
        ),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam')),
    },
    {
      path: '/org/teams/edit/:id/:page?',
      roles: () =>
        contextSrv.evaluatePermission(
          () => (config.editorsCanAdmin ? ['Editor', 'Admin'] : ['Admin']),
          [AccessControlAction.ActionTeamsRead, AccessControlAction.ActionTeamsCreate]
        ),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages')),
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
        () => import(/* webpackChunkName: "SignupInvited" */ 'app/features/invites/SignupInvited')
      ),
      pageClass: 'sidemenu-hidden',
    },
    {
      path: '/verify',
      component: !config.verifyEmailEnabled
        ? () => <Redirect to="/signup" />
        : SafeDynamicImport(
            () => import(/* webpackChunkName "VerifyEmailPage"*/ 'app/core/components/Signup/VerifyEmailPage')
          ),
      pageClass: 'login-page sidemenu-hidden',
    },
    {
      path: '/signup',
      component: config.disableUserSignUp
        ? () => <Redirect to="/login" />
        : SafeDynamicImport(() => import(/* webpackChunkName "SignupPage"*/ 'app/core/components/Signup/SignupPage')),
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
      path: '/sandbox/test',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "TestStuffPage"*/ 'app/features/sandbox/TestStuffPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/library-panels',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderLibraryPanelsPage"*/ 'app/features/folders/FolderLibraryPanelsPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/alerting',
      roles: () =>
        contextSrv.evaluatePermission(() => ['Viewer', 'Editor', 'Admin'], [AccessControlAction.AlertingRuleRead]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderAlerting"*/ 'app/features/folders/FolderAlerting')
      ),
    },
    {
      path: '/library-panels',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "LibraryPanelsPage"*/ 'app/features/library-panels/LibraryPanelsPage')
      ),
    },
    {
      path: '/notifications',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NotificationsPage"*/ 'app/features/notifications/NotificationsPage')
      ),
    },
    ...getPluginCatalogRoutes(),
    ...getLiveRoutes(),
    ...getAlertingRoutes(),
    ...getProfileRoutes(),
    ...extraRoutes,
    {
      path: '/*',
      component: ErrorPage,
    },
    // TODO[Router]
    // ...playlistRoutes,
  ];
}
