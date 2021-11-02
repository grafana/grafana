import { __read, __spreadArray } from "tslib";
import React from 'react';
import LdapPage from 'app/features/admin/ldap/LdapPage';
import UserAdminPage from 'app/features/admin/UserAdminPage';
import { LoginPage } from 'app/core/components/Login/LoginPage';
import config from 'app/core/config';
import { AccessControlAction, DashboardRoutes } from 'app/types';
import { SafeDynamicImport } from '../core/components/DynamicImports/SafeDynamicImport';
import { Redirect } from 'react-router-dom';
import ErrorPage from 'app/core/components/ErrorPage/ErrorPage';
import { getPluginsAdminRoutes } from 'app/features/plugins/routes';
import { contextSrv } from 'app/core/services/context_srv';
import { getLiveRoutes } from 'app/features/live/pages/routes';
import { getAlertingRoutes } from 'app/features/alerting/routes';
export var extraRoutes = [];
export function getAppRoutes() {
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([
        {
            path: '/',
            pageClass: 'page-dashboard',
            routeName: DashboardRoutes.Home,
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'); }),
        },
        {
            path: '/d/:uid/:slug?',
            pageClass: 'page-dashboard',
            routeName: DashboardRoutes.Normal,
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'); }),
        },
        {
            path: '/dashboard/:type/:slug',
            pageClass: 'page-dashboard',
            routeName: DashboardRoutes.Normal,
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'); }),
        },
        {
            path: '/dashboard/new',
            pageClass: 'page-dashboard',
            routeName: DashboardRoutes.New,
            // TODO[Router]
            //roles: () => (contextSrv.hasEditPermissionInFolders ? [contextSrv.user.orgRole] : ['Admin']),
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardPage" */ '../features/dashboard/containers/DashboardPage'); }),
        },
        {
            path: '/d-solo/:uid/:slug',
            pageClass: 'dashboard-solo',
            routeName: DashboardRoutes.Normal,
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage'); }),
        },
        {
            path: '/d-solo/:uid',
            pageClass: 'dashboard-solo',
            routeName: DashboardRoutes.Normal,
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "SoloPanelPage" */ '../features/dashboard/containers/SoloPanelPage'); }),
        },
        {
            path: '/dashboard/import',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardImport"*/ 'app/features/manage-dashboards/DashboardImportPage'); }),
        },
        {
            path: '/datasources',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DataSourcesListPage"*/ 'app/features/datasources/DataSourcesListPage'); }),
        },
        {
            path: '/datasources/edit/:uid/',
            component: SafeDynamicImport(function () {
                return import(
                /* webpackChunkName: "DataSourceSettingsPage"*/ '../features/datasources/settings/DataSourceSettingsPage');
            }),
        },
        {
            path: '/datasources/edit/:uid/dashboards',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DataSourceDashboards"*/ 'app/features/datasources/DataSourceDashboards'); }),
        },
        {
            path: '/datasources/new',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NewDataSourcePage"*/ '../features/datasources/NewDataSourcePage'); }),
        },
        {
            path: '/dashboards',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage'); }),
        },
        {
            path: '/dashboards/folder/new',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NewDashboardsFolder"*/ 'app/features/folders/components/NewDashboardsFolder'); }),
        },
        {
            path: '/dashboards/f/:uid/:slug/permissions',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "FolderPermissions"*/ 'app/features/folders/FolderPermissions'); }),
        },
        {
            path: '/dashboards/f/:uid/:slug/settings',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "FolderSettingsPage"*/ 'app/features/folders/FolderSettingsPage'); }),
        },
        {
            path: '/dashboards/f/:uid/:slug',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage'); }),
        },
        {
            path: '/dashboards/f/:uid',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "DashboardListPage"*/ 'app/features/search/components/DashboardListPage'); }),
        },
        {
            path: '/explore',
            pageClass: 'page-explore',
            roles: function () {
                return contextSrv.evaluatePermission(function () { return (config.viewersCanEdit ? [] : ['Editor', 'Admin']); }, [
                    AccessControlAction.DataSourcesExplore,
                ]);
            },
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "explore" */ 'app/features/explore/Wrapper'); }),
        },
        {
            path: '/a/:pluginId/',
            exact: false,
            // Someday * and will get a ReactRouter under that path!
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AppRootPage" */ 'app/features/plugins/AppRootPage'); }),
        },
        {
            path: '/org',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "OrgDetailsPage" */ '../features/org/OrgDetailsPage'); }),
        },
        {
            path: '/org/new',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NewOrgPage" */ 'app/features/org/NewOrgPage'); }),
        },
        {
            path: '/org/users',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "UsersListPage" */ 'app/features/users/UsersListPage'); }),
        },
        {
            path: '/org/users/invite',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "UserInvitePage" */ 'app/features/org/UserInvitePage'); }),
        },
        {
            path: '/org/apikeys',
            roles: function () { return ['Editor', 'Admin']; },
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "ApiKeysPage" */ 'app/features/api-keys/ApiKeysPage'); }),
        },
        {
            path: '/org/teams',
            roles: function () { return (config.editorsCanAdmin ? [] : ['Editor', 'Admin']); },
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "TeamList" */ 'app/features/teams/TeamList'); }),
        },
        {
            path: '/org/teams/new',
            roles: function () { return (config.editorsCanAdmin ? [] : ['Admin']); },
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "CreateTeam" */ 'app/features/teams/CreateTeam'); }),
        },
        {
            path: '/org/teams/edit/:id/:page?',
            roles: function () { return (config.editorsCanAdmin ? [] : ['Admin']); },
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "TeamPages" */ 'app/features/teams/TeamPages'); }),
        },
        {
            path: '/profile',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "UserProfileEditPage" */ 'app/features/profile/UserProfileEditPage'); }),
        },
        {
            path: '/profile/password',
            component: SafeDynamicImport(function () { return import(/* webPackChunkName: "ChangePasswordPage" */ 'app/features/profile/ChangePasswordPage'); }),
        },
        {
            path: '/profile/select-org',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "SelectOrgPage" */ 'app/features/org/SelectOrgPage'); }),
        },
        // ADMIN
        {
            path: '/admin',
            // eslint-disable-next-line react/display-name
            component: function () { return React.createElement(Redirect, { to: "/admin/users" }); },
        },
        {
            path: '/admin/settings',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AdminSettings" */ 'app/features/admin/AdminSettings'); }),
        },
        {
            path: '/admin/upgrading',
            component: SafeDynamicImport(function () { return import('app/features/admin/UpgradePage'); }),
        },
        {
            path: '/admin/users',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "UserListAdminPage" */ 'app/features/admin/UserListAdminPage'); }),
        },
        {
            path: '/admin/users/create',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "UserCreatePage" */ 'app/features/admin/UserCreatePage'); }),
        },
        {
            path: '/admin/users/edit/:id',
            component: UserAdminPage,
        },
        {
            path: '/admin/orgs',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AdminListOrgsPage" */ 'app/features/admin/AdminListOrgsPage'); }),
        },
        {
            path: '/admin/orgs/edit/:id',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AdminEditOrgPage" */ 'app/features/admin/AdminEditOrgPage'); }),
        },
        {
            path: '/admin/stats',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "ServerStats" */ 'app/features/admin/ServerStats'); }),
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
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "SignupInvited" */ 'app/features/users/SignupInvited'); }),
            pageClass: 'sidemenu-hidden',
        },
        {
            path: '/verify',
            component: !config.verifyEmailEnabled
                ? function () { return React.createElement(Redirect, { to: "/signup" }); }
                : SafeDynamicImport(function () { return import(/* webpackChunkName "VerifyEmailPage"*/ 'app/core/components/Signup/VerifyEmailPage'); }),
            pageClass: 'login-page sidemenu-hidden',
        },
        {
            path: '/signup',
            component: config.disableUserSignUp
                ? function () { return React.createElement(Redirect, { to: "/login" }); }
                : SafeDynamicImport(function () { return import(/* webpackChunkName "SignupPage"*/ 'app/core/components/Signup/SignupPage'); }),
            pageClass: 'sidemenu-hidden login-page',
        },
        {
            path: '/user/password/send-reset-email',
            pageClass: 'sidemenu-hidden',
            component: SafeDynamicImport(function () {
                return import(/* webpackChunkName: "SendResetMailPage" */ 'app/core/components/ForgottenPassword/SendResetMailPage');
            }),
        },
        {
            path: '/user/password/reset',
            component: SafeDynamicImport(function () {
                return import(
                /* webpackChunkName: "ChangePasswordPage" */ 'app/core/components/ForgottenPassword/ChangePasswordPage');
            }),
            pageClass: 'sidemenu-hidden login-page',
        },
        {
            path: '/dashboard/snapshots',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "SnapshotListPage" */ 'app/features/manage-dashboards/SnapshotListPage'); }),
        },
        // TODO[Router]
        // {
        //   path: '/plugins/:pluginId/page/:slug',
        //   templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
        //   controller: 'AppPageCtrl',
        //   controllerAs: 'ctrl',
        // },
        {
            path: '/playlists',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PlaylistPage"*/ 'app/features/playlist/PlaylistPage'); }),
        },
        {
            path: '/playlists/play/:id',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PlaylistStartPage"*/ 'app/features/playlist/PlaylistStartPage'); }),
        },
        {
            path: '/playlists/new',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PlaylistNewPage"*/ 'app/features/playlist/PlaylistNewPage'); }),
        },
        {
            path: '/playlists/edit/:id',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "PlaylistEditPage"*/ 'app/features/playlist/PlaylistEditPage'); }),
        },
        {
            path: '/sandbox/benchmarks',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "BenchmarksPage"*/ 'app/features/sandbox/BenchmarksPage'); }),
        },
        {
            path: '/sandbox/test',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "TestStuffPage"*/ 'app/features/sandbox/TestStuffPage'); }),
        },
        {
            path: '/dashboards/f/:uid/:slug/library-panels',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "FolderLibraryPanelsPage"*/ 'app/features/folders/FolderLibraryPanelsPage'); }),
        },
        {
            path: '/library-panels',
            component: SafeDynamicImport(function () { return import(/* webpackChunkName: "LibraryPanelsPage"*/ 'app/features/library-panels/LibraryPanelsPage'); }),
        }
    ], __read(getPluginsAdminRoutes()), false), __read(getLiveRoutes()), false), __read(getAlertingRoutes()), false), __read(extraRoutes), false), [
        {
            path: '/*',
            component: ErrorPage,
        },
    ], false);
}
//# sourceMappingURL=routes.js.map