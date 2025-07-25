import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom-v5-compat';

import { isTruthy } from '@grafana/data';
import { NavLandingPage } from 'app/core/components/NavLandingPage/NavLandingPage';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import { getAlertingRoutes } from 'app/features/alerting/routes';
import { isAdmin, isLocalDevEnv, isOpenSourceEdition } from 'app/features/alerting/unified/utils/misc';
import { ConnectionsRedirectNotice } from 'app/features/connections/components/ConnectionsRedirectNotice';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { getRoutes as getDataConnectionsRoutes } from 'app/features/connections/routes';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';
import { ConfigureIRM } from 'app/features/gops/configuration-tracker/components/ConfigureIRM';
import { getRoutes as getPluginCatalogRoutes } from 'app/features/plugins/admin/routes';
import { getAppPluginRoutes } from 'app/features/plugins/routes';
import { getProfileRoutes } from 'app/features/profile/routes';
import { AccessControlAction } from 'app/types/accessControl';
import { DashboardRoutes } from 'app/types/dashboard';

import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from '../core/navigation/types';
import { getPublicDashboardRoutes } from '../features/dashboard/routes';
import { getProvisioningRoutes } from '../features/provisioning/utils/routes';

const isDevEnv = config.buildInfo.env === 'development';
export const extraRoutes: RouteDescriptor[] = [];

export function getAppRoutes(): RouteDescriptor[] {
  return [
    // Based on the Grafana configuration standalone plugin pages can even override and extend existing core pages, or they can register new routes under existing ones.
    // In order to make it possible we need to register them first due to how `<Switch>` is evaluating routes. (This will be unnecessary once/when we upgrade to React Router v6 and start using `<Routes>` instead.)
    ...getAppPluginRoutes(),
    {
      path: '/',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Home,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPageProxy" */ '../features/dashboard/containers/DashboardPageProxy')
      ),
    },
    {
      path: '/d/:uid/:slug?',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPageProxy" */ '../features/dashboard/containers/DashboardPageProxy')
      ),
    },
    {
      path: '/dashboard/new',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.DashboardsCreate]),
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.New,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPageProxy')
      ),
    },
    {
      path: '/dashboard/new-with-ds/:datasourceUid',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.DashboardsCreate]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/NewDashboardWithDS')
      ),
    },
    {
      path: '/dashboard/:type/:slug',
      pageClass: 'page-dashboard',
      routeName: DashboardRoutes.Normal,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPageProxy')
      ),
    },
    {
      // We currently have no core usage of the embedded dashboard so is to have a page for e2e to test
      path: '/dashboards/embedding-test',
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "DashboardPage"*/ 'app/features/dashboard-scene/embedding/EmbeddedDashboardTestPage'
          )
      ),
    },
    {
      path: '/d-solo/:uid/:slug?',
      routeName: DashboardRoutes.Normal,
      chromeless: true,
      component: SafeDynamicImport(() =>
        config.featureToggles.dashboardSceneSolo
          ? import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard-scene/solo/SoloPanelPage')
          : import(/* webpackChunkName: "SoloPanelPageOld" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    // This route handles embedding of snapshot/scripted dashboard panels
    {
      path: '/dashboard-solo/:type/:slug',
      routeName: DashboardRoutes.Normal,
      chromeless: true,
      component: SafeDynamicImport(() =>
        config.featureToggles.dashboardSceneSolo
          ? import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard-scene/solo/SoloPanelPage')
          : import(/* webpackChunkName: "SoloPanelPageOld" */ '../features/dashboard/containers/SoloPanelPage')
      ),
    },
    {
      path: '/dashboard/import',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardImport"*/ 'app/features/manage-dashboards/DashboardImportPage')
      ),
    },
    {
      path: DATASOURCES_ROUTES.List,
      component: () => <Navigate replace to={CONNECTIONS_ROUTES.DataSources} />,
    },
    {
      path: DATASOURCES_ROUTES.Edit,
      component: DataSourceEditRoute,
    },
    {
      path: DATASOURCES_ROUTES.Dashboards,
      component: DataSourceDashboardRoute,
    },
    {
      path: DATASOURCES_ROUTES.New,
      component: () => <Navigate replace to={CONNECTIONS_ROUTES.DataSourcesNew} />,
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
    {
      path: '/dashboards',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/browse-dashboards/BrowseDashboardsPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/browse-dashboards/BrowseDashboardsPage')
      ),
    },
    {
      path: '/dashboards/f/:uid',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/browse-dashboards/BrowseDashboardsPage')
      ),
    },
    {
      path: '/explore',
      pageClass: 'page-explore',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.DataSourcesExplore]),
      component: SafeDynamicImport(() =>
        config.exploreEnabled
          ? import(/* webpackChunkName: "explore" */ 'app/features/explore/ExplorePage')
          : import(/* webpackChunkName: "explore-feature-toggle-page" */ 'app/features/explore/FeatureTogglePage')
      ),
    },
    {
      path: '/drilldown',
      component: () => <NavLandingPage navId="drilldown" />,
    },
    {
      path: '/apps',
      component: () => <NavLandingPage navId="apps" />,
    },
    {
      path: '/alerts-and-incidents',
      component: () => {
        return (
          <NavLandingPage
            navId="alerts-and-incidents"
            header={(!isOpenSourceEdition() && isAdmin()) || isLocalDevEnv() ? <ConfigureIRM /> : undefined}
          />
        );
      },
    },
    {
      path: '/testing-and-synthetics',
      component: () => <NavLandingPage navId="testing-and-synthetics" />,
    },
    {
      path: '/monitoring',
      component: () => <Navigate replace to="/observability" />,
    },
    {
      path: '/observability',
      component: () => <NavLandingPage navId="observability" />,
    },
    {
      path: '/infrastructure',
      component: () => <NavLandingPage navId="infrastructure" />,
    },
    {
      path: '/frontend',
      component: () => <NavLandingPage navId="frontend" />,
    },
    {
      path: '/admin/general',
      component: () => <NavLandingPage navId="cfg/general" />,
    },
    {
      path: '/admin/plugins',
      component: () => <NavLandingPage navId="cfg/plugins" />,
    },
    {
      path: '/admin/extensions',
      navId: 'extensions',
      roles: () =>
        contextSrv.evaluatePermission([AccessControlAction.PluginsInstall, AccessControlAction.PluginsWrite]),
      component:
        isDevEnv || config.featureToggles.enableExtensionsAdminPage
          ? SafeDynamicImport(
              () =>
                import(/* webpackChunkName: "PluginExtensionsLog" */ 'app/features/plugins/extensions/logs/LogViewer')
            )
          : () => <Navigate replace to="/admin" />,
    },
    {
      path: '/admin/access',
      component: () => <NavLandingPage navId="cfg/access" />,
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
      // Org users page has been combined with admin users
      component: () => <Navigate replace to={'/admin/users'} />,
    },
    {
      path: '/org/users/invite',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserInvitePage" */ 'app/features/org/UserInvitePage')
      ),
    },
    {
      path: '/org/serviceaccounts',
      roles: () =>
        contextSrv.evaluatePermission([
          AccessControlAction.ServiceAccountsRead,
          AccessControlAction.ServiceAccountsCreate,
        ]),
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
        contextSrv.evaluatePermission([AccessControlAction.ActionTeamsRead, AccessControlAction.ActionTeamsCreate]),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList')),
    },
    {
      path: '/org/teams/new',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.ActionTeamsCreate]),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam')),
    },
    {
      path: '/org/teams/edit/:uid/:page?',
      roles: () =>
        contextSrv.evaluatePermission([AccessControlAction.ActionTeamsRead, AccessControlAction.ActionTeamsCreate]),
      component: SafeDynamicImport(() => import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages')),
    },
    // ADMIN
    {
      path: '/admin',
      component: () => <NavLandingPage navId="cfg" header={<ConnectionsRedirectNotice />} />,
    },
    {
      path: '/admin/authentication',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.SettingsWrite]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AdminAuthentication" */ '../features/auth-config/AuthProvidersListPage')
      ),
    },
    {
      path: '/admin/authentication/ldap',
      component: config.featureToggles.ssoSettingsLDAP
        ? SafeDynamicImport(
            () => import(/* webpackChunkName: "LdapSettingsPage" */ 'app/features/admin/ldap/LdapSettingsPage')
          )
        : LdapPage,
    },
    {
      path: '/admin/authentication/:provider',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.SettingsWrite]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "AdminAuthentication" */ '../features/auth-config/ProviderConfigPage')
      ),
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
        () => import(/* webpackChunkName: "UserListPage" */ 'app/features/admin/UserListPage')
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
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "UserAdminPage" */ 'app/features/admin/UserAdminPage')
      ),
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
      path: '/admin/featuretoggles',
      component: config.featureToggles.featureToggleAdminPage
        ? SafeDynamicImport(
            () => import(/* webpackChunkName: "AdminFeatureTogglesPage" */ 'app/features/admin/AdminFeatureTogglesPage')
          )
        : () => <Navigate replace to="/admin" />,
    },
    {
      path: '/admin/stats',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "ServerStats" */ 'app/features/admin/ServerStats')
      ),
    },
    config.featureToggles.onPremToCloudMigrations && {
      path: '/admin/migrate-to-cloud',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.MigrationAssistantMigrate]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "MigrateToCloud" */ 'app/features/migrate-to-cloud/MigrateToCloud')
      ),
    },
    // LOGIN / SIGNUP
    {
      path: '/login',
      allowAnonymous: true,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "LoginPage" */ 'app/core/components/Login/LoginPage')
      ),
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
        ? () => <Navigate replace to="/signup" />
        : SafeDynamicImport(
            () => import(/* webpackChunkName "VerifyEmailPage"*/ 'app/core/components/Signup/VerifyEmailPage')
          ),
      pageClass: 'login-page',
      chromeless: true,
    },
    {
      path: '/signup',
      allowAnonymous: true,
      component: config.disableUserSignUp
        ? () => <Navigate replace to="/login" />
        : SafeDynamicImport(() => import(/* webpackChunkName "SignupPage"*/ 'app/core/components/Signup/SignupPage')),
      pageClass: 'login-page',
      chromeless: true,
    },
    {
      path: '/user/password/send-reset-email',
      allowAnonymous: true,
      chromeless: true,
      component: SafeDynamicImport(
        () =>
          import(/* webpackChunkName: "SendResetMailPage" */ 'app/core/components/ForgottenPassword/SendResetMailPage')
      ),
    },
    {
      path: '/user/password/reset',
      allowAnonymous: true,
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
      roles: () => contextSrv.evaluatePermission([AccessControlAction.SnapshotsRead]),
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
      allowAnonymous: true, // purposefully to allow testing
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "TestStuffPage"*/ 'app/features/sandbox/TestStuffPage')
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/library-panels',
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "FolderLibraryPanelsPage"*/ 'app/features/browse-dashboards/BrowseFolderLibraryPanelsPage'
          )
      ),
    },
    {
      path: '/dashboards/f/:uid/:slug/alerting',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.AlertingRuleRead]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "FolderAlerting"*/ 'app/features/browse-dashboards/BrowseFolderAlertingPage')
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
    {
      // A redirect to the Grafana Metrics Drilldown app from legacy Explore Metrics routes
      path: '/explore/metrics/*',
      roles: () => contextSrv.evaluatePermission([AccessControlAction.DataSourcesExplore]),
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "MetricsDrilldownRedirect"*/ 'app/features/trails/RedirectToDrilldownApp')
      ),
    },
    {
      path: '/bookmarks',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "BookmarksPage"*/ 'app/features/bookmarks/BookmarksPage')
      ),
    },
    config.featureToggles.restoreDashboards && {
      path: '/dashboard/recently-deleted',
      roles: () => ['Admin', 'ServerAdmin'],
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RecentlyDeletedPage" */ 'app/features/browse-dashboards/RecentlyDeletedPage')
      ),
    },
    {
      // Redirect the /femt dev page to the root
      path: '/femt',
      component: () => <Navigate replace to="/" />,
    },
    ...getPluginCatalogRoutes(),
    ...getSupportBundleRoutes(),
    ...getAlertingRoutes(),
    ...getProfileRoutes(),
    ...extraRoutes,
    ...getPublicDashboardRoutes(),
    ...getDataConnectionsRoutes(),
    ...getProvisioningRoutes(),
    {
      path: '/goto/*',
      component: HandleGoToRedirect,
    },
    {
      path: '/*',
      component: PageNotFound,
    },
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

function DataSourceDashboardRoute() {
  const { uid = '' } = useParams();
  return <Navigate replace to={CONNECTIONS_ROUTES.DataSourcesDashboards.replace(':uid', uid)} />;
}

function DataSourceEditRoute() {
  const { uid = '' } = useParams();
  return <Navigate replace to={CONNECTIONS_ROUTES.DataSourcesEdit.replace(':uid', uid)} />;
}

// Explicitly send "goto" URLs to server, bypassing client-side routing
function HandleGoToRedirect() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.location.href = pathname;
  }, [pathname]);

  return null;
}
