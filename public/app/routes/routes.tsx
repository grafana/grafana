import React from 'react';
import { Redirect } from 'react-router-dom';

import { isTruthy } from '@grafana/data';
import { NavLandingPage } from 'app/core/components/AppChrome/NavLandingPage';
import { ErrorPage } from 'app/core/components/ErrorPage/ErrorPage';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import { getAlertingRoutes } from 'app/features/alerting/routes';
import { getRoutes as getDataConnectionsRoutes } from 'app/features/connections/routes';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { getRoutes as getPluginCatalogRoutes } from 'app/features/plugins/admin/routes';
import { getAppPluginRoutes } from 'app/features/plugins/routes';
import { getProfileRoutes } from 'app/features/profile/routes';
import { AccessControlAction, DashboardRoutes } from 'app/types';

import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from '../core/navigation/types';
import { getPublicDashboardRoutes } from '../features/dashboard/routes';

export const extraRoutes: RouteDescriptor[] = [];

export function getAppRoutes(): RouteDescriptor[] {
  const topnavRoutes: RouteDescriptor[] = config.featureToggles.topnav
    ? [
        {
          path: '/apps',
          component: () => <NavLandingPage navId="apps" />,
        },
        {
          path: '/alerts-and-incidents',
          component: () => <NavLandingPage navId="alerts-and-incidents" />,
        },
        {
          path: '/monitoring',
          component: () => <NavLandingPage navId="monitoring" />,
        },
        {
          path: '/admin/general',
          component: () => <NavLandingPage navId="admin/general" />,
        },
        {
          path: '/admin/plugins',
          component: () => <NavLandingPage navId="admin/plugins" />,
        },
        {
          path: '/admin/access',
          component: () => <NavLandingPage navId="admin/access" />,
        },
      ]
    : [];

  return [
    // Based on the Grafana configuration standalone plugin pages can even override and extend existing core pages, or they can register new routes under existing ones.
    // In order to make it possible we need to register them first due to how `<Switch>` is evaluating routes. (This will be unnecessary once/when we upgrade to React Router v6 and start using `<Routes>` instead.)
    ...getAppPluginRoutes(),
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
      path: '/dashboard/new',
      roles: () => contextSrv.evaluatePermission(() => ['Editor', 'Admin'], [AccessControlAction.DashboardsCreate]),
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.New,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/NewDashboardPage')
      ),
    },
    {
      path: '/dashboard/new-with-ds/:datasourceUid',
      roles: () => contextSrv.evaluatePermission(() => ['Editor', 'Admin'], [AccessControlAction.DashboardsCreate]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/NewDashboardWithDS')
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
      path: '/d-solo/:uid/:slug',
      pageClass: 'dashboard-solo',
      routeName: DashboardRoutes.Normal,
      chromeless: true,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    // This route handles embedding of snapshot/scripted dashboard panels
    {
      path: '/dashboard-solo/:type/:slug',
      pageClass: 'dashboard-solo',
      routeName: DashboardRoutes.Normal,
      chromeless: true,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    {
      path: '/d-solo/:uid',
      pageClass: 'dashboard-solo',
      routeName: DashboardRoutes.Normal,
      chromeless: true,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    {
      path: '/dashboard/import',
      roles: () => contextSrv.evaluatePermission(() => ['Editor', 'Admin'], [AccessControlAction.DashboardsCreate]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardImport"*/ 'app/features/manage-dashboards/DashboardImportPage')
      ),
    },
    {
      path: DATASOURCES_ROUTES.List,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DataSourcesListPage"*/ 'app/features/datasources/pages/DataSourcesListPage')
      ),
    },
    {
      path: DATASOURCES_ROUTES.Edit,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "EditDataSourcePage"*/ '../features/datasources/pages/EditDataSourcePage')
      ),
    },
    {
      path: DATASOURCES_ROUTES.Dashboards,
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "DataSourceDashboards"*/ 'app/features/datasources/pages/DataSourceDashboardsPage'
          )
      ),
    },
    {
      path: DATASOURCES_ROUTES.New,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NewDataSourcePage"*/ '../features/datasources/pages/NewDataSourcePage')
      ),
    },
    {
      path: '/datasources/correlations',
      component: SafeDynamicImport(() =>
        config.featureToggles.correlations
          ? import(/* webpackChunkName: "CorrelationsPage" */ 'app/features/correlations/CorrelationsPage')
          : import(
              /* webpackChunkName: "CorrelationsFeatureToggle" */ 'app/features/correlations/CorrelationsFeatureToggle'
            )
      ),
    },

    ...(config.featureToggles.nestedFolders ? getNestedFoldersRoutes() : []),

    {
      path: '/dashboards',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage')
      ),
    },
    {
      path: '/dashboards/folder/new',
      roles: () => contextSrv.evaluatePermission(() => ['Editor', 'Admin'], [AccessControlAction.FoldersCreate]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "NewDashboardsFolder"*/ 'app/features/folders/components/NewDashboardsFolder')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/permissions',
      component: config.rbacEnabled
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
          ? import(/* webpackChunkName: "explore" */ 'app/features/explore/EmptyStateWrapper')
          : import(/* webpackChunkName: "explore-feature-toggle-page" */ 'app/features/explore/FeatureTogglePage')
      ),
    },
    ...topnavRoutes,
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
      roles: () =>
        contextSrv.evaluatePermission(
          () => ['Admin'],
          [AccessControlAction.ServiceAccountsRead, AccessControlAction.ServiceAccountsCreate]
        ),
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
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ServiceAccountPage" */ 'app/features/serviceaccounts/ServiceAccountPage')
      ),
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
      component: () => (config.featureToggles.topnav ? <NavLandingPage navId="cfg" /> : <Redirect to="/admin/users" />),
    },
    {
      path: '/admin/access',
      component: () =>
        config.featureToggles.topnav ? <NavLandingPage navId="admin/access" /> : <Redirect to="/admin/users" />,
    },
    {
      path: '/admin/config',
      component: () =>
        config.featureToggles.topnav ? <NavLandingPage navId="admin/config" /> : <Redirect to="/admin/org" />,
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
      component: config.featureToggles.topnav
        ? SafeDynamicImport(() => import(/* webpackChunkName: "UserListPage" */ 'app/features/admin/UserListPage'))
        : SafeDynamicImport(
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
      path: '/admin/storage/:path*',
      roles: () => ['Admin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "StoragePage" */ 'app/features/storage/StoragePage')
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
      pageClass: 'login-page',
      chromeless: true,
    },
    {
      path: '/invite/:code',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SignupInvited" */ 'app/features/invites/SignupInvited')
      ),
      chromeless: true,
    },
    {
      path: '/verify',
      component: !config.verifyEmailEnabled
        ? () => <Redirect to="/signup" />
        : SafeDynamicImport(
            () => import(/* webpackChunkName "VerifyEmailPage"*/ 'app/core/components/Signup/VerifyEmailPage')
          ),
      pageClass: 'login-page',
      chromeless: true,
    },
    {
      path: '/signup',
      component: config.disableUserSignUp
        ? () => <Redirect to="/login" />
        : SafeDynamicImport(() => import(/* webpackChunkName "SignupPage"*/ 'app/core/components/Signup/SignupPage')),
      pageClass: 'login-page',
      chromeless: true,
    },
    {
      path: '/user/password/send-reset-email',
      chromeless: true,
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
      pageClass: 'login-page',
      chromeless: true,
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
      path: '/playlists/play/:uid',
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
      path: '/playlists/edit/:uid',
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
    ...getDynamicDashboardRoutes(),
    ...getPluginCatalogRoutes(),
    ...getSupportBundleRoutes(),
    ...getAlertingRoutes(),
    ...getProfileRoutes(),
    ...extraRoutes,
    ...getPublicDashboardRoutes(),
    ...getDataConnectionsRoutes(),
    {
      path: '/*',
      component: ErrorPage,
    },
    // TODO[Router]
    // ...playlistRoutes,
  ].filter(isTruthy);
}

export function getSupportBundleRoutes(cfg = config): RouteDescriptor[] {
  if (!cfg.supportBundlesEnabled) {
    return [];
  }

  return [
    {
      path: '/support-bundles',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SupportBundles" */ 'app/features/support-bundles/SupportBundles')
      ),
    },
    {
      path: '/support-bundles/create',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "SupportBundlesCreate" */ 'app/features/support-bundles/SupportBundlesCreate')
      ),
    },
  ];
}

export function getDynamicDashboardRoutes(cfg = config): RouteDescriptor[] {
  if (!cfg.featureToggles.scenes) {
    return [];
  }
  return [
    {
      path: '/scenes',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "scenes"*/ 'app/features/scenes/SceneListPage')),
    },
    {
      path: '/scenes/dashboard/:uid',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "scenes"*/ 'app/features/scenes/dashboard/DashboardScenePage')
      ),
    },
    {
      path: '/scenes/grafana-monitoring',
      exact: false,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "scenes"*/ 'app/features/scenes/apps/GrafanaMonitoringApp')
      ),
    },
    {
      path: '/scenes/:name',
      component: SafeDynamicImport(() => import(/* webpackChunkName: "scenes"*/ 'app/features/scenes/ScenePage')),
    },
  ];
}

function getNestedFoldersRoutes(): RouteDescriptor[] {
  return [
    {
      path: '/nested-dashboards',
      component: SafeDynamicImport(() => import('app/features/browse-dashboards/BrowseDashboardsPage')),
    },

    {
      path: '/nested-dashboards/f/:uid',
      component: SafeDynamicImport(() => import('app/features/browse-dashboards/BrowseDashboardsPage')),
    },

    {
      path: '/nested-dashboards/f/:uid/:slug',
      component: SafeDynamicImport(() => import('app/features/browse-dashboards/BrowseDashboardsPage')),
    },
  ];
}
