///<reference path="../../headers/common.d.ts" />

import './dashboard_loaders';

import angular from 'angular';
import coreModule from 'app/core/core_module';
import {BundleLoader} from './bundle_loader';

/** @ngInject **/
function setupAngularRoutes($routeProvider, $locationProvider) {
  $locationProvider.html5Mode(true);

  var loadPluginsBundle = new BundleLoader('app/features/plugins/all');
  var loadAdminBundle = new BundleLoader('app/features/admin/admin');
  var loadOrgBundle = new BundleLoader('app/features/org/all');
  var loadOncallerBundle = new BundleLoader('app/features/oncaller/all');
  var loadCMDBBundle = new BundleLoader('app/features/cmdb/all');
  var loadSetupBundle = new BundleLoader('app/features/setup/all');
  var loadSummaryBundle = new BundleLoader('app/features/summary/all');
  var loadAnomalyBundle = new BundleLoader('app/features/anomaly/all');
  var loadProfileBundle = new BundleLoader('app/features/profile/all');
  var loadServiceBundle = new BundleLoader('app/features/service/all');
  var loadHealthBundle = new BundleLoader('app/features/health/all');
  var loadAnalysisBundle = new BundleLoader('app/features/analysis/all');
  var loadLogsBundle = new BundleLoader('app/features/logs/all');
  var loadReportBundle = new BundleLoader('app/features/report/reportCtrl');

  $routeProvider
  .when('/', {
    templateUrl: 'public/app/features/systemoverview/partials/system_overview.html',
    controller : 'SystemOverviewCtrl',
    reloadOnSearch: false,
  })
  .when('/dashboardlist', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'LoadDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/systems', {
    templateUrl: 'public/app/partials/systems.html',
    reloadOnSearch: false,
  })
  .when('/summary', {
    templateUrl: 'public/app/features/summary/partials/summary.html',
    controller: 'SummaryCtrl',
    reloadOnSearch: false,
    resolve: loadSummaryBundle,
  })
  .when('/service', {
    templateUrl: 'public/app/features/summary/partials/service.html',
    controller: 'ServiceCtrl',
    reloadOnSearch: false,
    resolve: loadSummaryBundle,
  })
  .when('/service_v2', {
    templateUrl: 'public/app/features/service/partials/service.html',
    controller: 'ServiceStatusCtrl',
    reloadOnSearch: true,
    resolve: loadServiceBundle,
  })
  .when('/dashboard/:type/:slug', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'LoadDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/dashboard-solo/:type/:slug', {
    templateUrl: 'public/app/features/panel/partials/soloPanel.html',
    controller : 'SoloPanelCtrl',
    pageClass: 'page-dashboard',
  })
  .when('/dashboard-import/:file', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'DashFromImportCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/dashboard/new', {
    templateUrl: 'public/app/partials/dashboard.html',
    controller : 'NewDashboardCtrl',
    reloadOnSearch: false,
    pageClass: 'page-dashboard',
  })
  .when('/import/dashboard', {
    templateUrl: 'public/app/features/dashboard/partials/import.html',
    controller : 'DashboardImportCtrl',
  })
  .when('/datasources', {
    templateUrl: 'public/app/features/plugins/partials/ds_list.html',
    controller : 'DataSourcesCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/datasources/edit/:id', {
    templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
    controller : 'DataSourceEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/datasources/new', {
    templateUrl: 'public/app/features/plugins/partials/ds_edit.html',
    controller : 'DataSourceEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/alerts', {
    templateUrl: 'public/app/features/org/partials/alerts.html',
    controller : 'AlertsCtrl',
    resolve: loadOrgBundle,
  })
  .when('/alerts/edit/:id', {
    templateUrl: 'public/app/features/org/partials/alertEdit.html',
    controller : 'AlertEditCtrl',
    resolve: loadOrgBundle,
  })
  .when('/alerts/new', {
    templateUrl: 'public/app/features/org/partials/alertEdit.html',
    controller : 'AlertEditCtrl',
    resolve: loadOrgBundle,
  })
  .when('/alerts/status', {
    templateUrl: 'public/app/features/org/partials/alertStatus.html',
    controller : 'AlertStatusCtrl',
    resolve: loadOrgBundle,
  })
  .when('/alerts/history', {
    templateUrl: 'public/app/features/org/partials/alertHistory.html',
    controller : 'AlertHistoryCtrl',
    resolve: loadOrgBundle,
  })
  .when('/alerts/association/:host/:distance/:metric*', {
    templateUrl: 'public/app/features/org/partials/alertAssociation.html',
    controller : 'AlertAssociationCtrl',
    resolve: loadOrgBundle,
  })
  .when('/oncallerschedule', {
    templateUrl: 'public/app/features/oncaller/partials/oncallerSchedule.html',
    controller : 'OnCallerScheduleCtrl',
    resolve: loadOncallerBundle,
  })
  .when('/oncallers', {
    templateUrl: 'public/app/features/oncaller/partials/oncallers.html',
    controller : 'OnCallersCtrl',
    resolve: loadOncallerBundle,
  })
  .when('/oncallers/edit/:id', {
    templateUrl: 'public/app/features/oncaller/partials/oncallerEdit.html',
    controller : 'OnCallerEditCtrl',
    resolve: loadOncallerBundle,
  })
  .when('/oncallers/new', {
    templateUrl: 'public/app/features/oncaller/partials/oncallerEdit.html',
    controller : 'OnCallerEditCtrl',
    resolve: loadOncallerBundle,
  })
  .when('/anomaly', {
    templateUrl: 'public/app/features/anomaly/partials/anomaly.html',
    controller : 'AnomalyCtrl',
    resolve: loadAnomalyBundle,
  })
  .when('/anomaly/history', {
    templateUrl: 'public/app/features/anomaly/partials/anomalyHistory.html',
    controller : 'AnomalyHistory',
    resolve: loadAnomalyBundle,
  })
  .when('/anomaly/:clusterId', {
    templateUrl: 'public/app/features/anomaly/partials/anomalyMetric.html',
    controller : 'AnomalyMetric',
    reloadOnSearch: true,
    resolve: loadAnomalyBundle,
  })
  .when('/decompose', {
    templateUrl: 'public/app/features/decompose/partials/compose.html',
    controller : 'DecomposeMetricCtrl'
  })
  .when('/org', {
    templateUrl: 'public/app/features/org/partials/orgDetails.html',
    controller : 'OrgDetailsCtrl',
    resolve: loadOrgBundle,
  })
  .when('/org/new', {
    templateUrl: 'public/app/features/org/partials/newOrg.html',
    controller : 'NewOrgCtrl',
    resolve: loadOrgBundle,
  })
  .when('/org/users', {
    templateUrl: 'public/app/features/org/partials/orgUsers.html',
    controller : 'OrgUsersCtrl',
    controllerAs: 'ctrl',
    resolve: loadOrgBundle,
  })
  .when('/org/apikeys', {
    templateUrl: 'public/app/features/org/partials/orgApiKeys.html',
    controller : 'OrgApiKeysCtrl',
    resolve: loadOrgBundle,
  })
  .when('/profile', {
    templateUrl: 'public/app/features/profile/partials/profile.html',
    controller : 'ProfileCtrl',
    resolve: loadProfileBundle,
  })
  .when('/profile/password', {
    templateUrl: 'public/app/features/profile/partials/password.html',
    controller : 'ChangePasswordCtrl',
    resolve: loadProfileBundle,
  })
  .when('/profile/select-org', {
    templateUrl: 'public/app/features/profile/partials/select_org.html',
    controller : 'SelectOrgCtrl',
    resolve: loadProfileBundle,
  })
  // ADMIN
  .when('/admin', {
    templateUrl: 'public/app/features/admin/partials/admin_home.html',
    controller : 'AdminHomeCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/settings', {
    templateUrl: 'public/app/features/admin/partials/settings.html',
    controller : 'AdminSettingsCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/stats', {
    templateUrl: 'public/app/features/admin/partials/stats.html',
    controller : 'AdminStatsCtrl',
    controllerAs: 'ctrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users', {
    templateUrl: 'public/app/features/admin/partials/users.html',
    controller : 'AdminListUsersCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users/create', {
    templateUrl: 'public/app/features/admin/partials/new_user.html',
    controller : 'AdminEditUserCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/users/edit/:id', {
    templateUrl: 'public/app/features/admin/partials/edit_user.html',
    controller : 'AdminEditUserCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/orgs', {
    templateUrl: 'public/app/features/admin/partials/orgs.html',
    controller : 'AdminListOrgsCtrl',
    resolve: loadAdminBundle,
  })
  .when('/admin/orgs/edit/:id', {
    templateUrl: 'public/app/features/admin/partials/edit_org.html',
    controller : 'AdminEditOrgCtrl',
    resolve: loadAdminBundle,
  })
  // LOGIN / SIGNUP
  .when('/login', {
    templateUrl: 'public/app/partials/login.html',
    controller : 'LoginCtrl',
  })
  .when('/signupfree', {
    templateUrl: 'public/app/partials/signup.html',
    controller : 'SignupFreeCtrl',
  })
  .when('/invite/:code', {
    templateUrl: 'public/app/partials/signup_invited.html',
    controller : 'InvitedCtrl',
  })
  .when('/signup', {
    templateUrl: 'public/app/partials/signup_step2.html',
    controller : 'SignUpCtrl',
  })
  .when('/user/password/send-reset-email', {
    templateUrl: 'public/app/partials/reset_password.html',
    controller : 'ResetPasswordCtrl',
  })
  .when('/user/password/reset', {
    templateUrl: 'public/app/partials/reset_password.html',
    controller : 'ResetPasswordCtrl',
  })
  .when('/dashboard/snapshots', {
    templateUrl: 'public/app/features/snapshot/partials/snapshots.html',
    controller : 'SnapshotsCtrl',
    controllerAs: 'ctrl',
  })
  .when('/plugins', {
    templateUrl: 'public/app/features/plugins/partials/plugin_list.html',
    controller: 'PluginListCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/plugins/:pluginId/edit', {
    templateUrl: 'public/app/features/plugins/partials/plugin_edit.html',
    controller: 'PluginEditCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/plugins/:pluginId/page/:slug', {
    templateUrl: 'public/app/features/plugins/partials/plugin_page.html',
    controller: 'AppPageCtrl',
    controllerAs: 'ctrl',
    resolve: loadPluginsBundle,
  })
  .when('/global-alerts', {
    templateUrl: 'public/app/features/dashboard/partials/globalAlerts.html',
  })
  .when('/logs', {
    templateUrl: 'public/app/features/logs/partials/logs.html',
    controller : 'LogsCtrl',
    resolve: loadLogsBundle,
  })
  .when('/analysis', {
    templateUrl: 'public/app/features/analysis/partials/analysis.html',
    controller : 'AnalysisCtrl',
    resolve: loadAnalysisBundle,
  })
  .when('/association', {
    templateUrl: 'public/app/features/analysis/partials/single_association.html',
    controller : 'SingleAssociationCtrl',
    resolve: loadAnalysisBundle,
  })
  .when('/knowledgebase', {
    templateUrl: 'public/app/features/logs/partials/knowledge_base.html',
    controller : 'KnowledgeBaseCtrl',
    resolve: loadLogsBundle,
  })
  .when('/install', {
    templateUrl: 'public/app/partials/install.html',
    controller : 'AnalysisCtrl',
    resolve: loadAnalysisBundle,
  })
  .when('/health', {
    templateUrl: 'public/app/features/health/partials/systemHealth.html',
    controller: 'SystemHealthCtrl',
    resolve: loadHealthBundle,
  })
  .when('/customer', {
    templateUrl: 'public/app/features/summary/partials/customer.html',
    controller: 'CustomerCtrl',
    resolve: loadSummaryBundle,
  })
  .when('/report', {
    templateUrl: 'public/app/features/report/partials/report.html',
    controller: 'ReportCtrl',
    reloadOnSearch: false,
    resolve: loadReportBundle
  })
  .when('/integrate', {
    templateUrl: 'public/app/features/analysis/partials/logIntegrate.html',
    controller : 'LogIntegrateCtrl',
    resolve: loadAnalysisBundle,
  })
  .when('/setting/agent', {
    templateUrl: 'public/app/features/setup/partials/host_agent.html',
    controller : 'HostAgentCtrl',
    resolve: loadSetupBundle,
  })
  .when('/setting/service', {
    templateUrl: 'public/app/features/setup/partials/service_agent.html',
    controller : 'ServiceAgentCtrl',
    resolve: loadSetupBundle,
  })
  .when('/setting/filebeat', {
    templateUrl: 'public/app/features/setup/partials/filebeat.html',
    controller : 'FilebeatCtrl',
    resolve: loadSetupBundle,
  })
  .when('/cmdb/hostlist', {
    templateUrl: 'public/app/features/cmdb/partials/host_list.html',
    controller : 'HostListCtrl',
    resolve: loadCMDBBundle
  })
  .when('/cmdb/hostlist/hostdetail', {
    templateUrl: 'public/app/features/cmdb/partials/host_detail.html',
    controller : 'HostDetailCtrl',
    resolve: loadCMDBBundle
  })
  .when('/cmdb/setup', {
    templateUrl: 'public/app/features/cmdb/partials/cmdb_setup.html',
    controller : 'CMDBSetupCtrl',
    resolve: loadCMDBBundle
  })
  .when('/cmdb/servicelist', {
    templateUrl: 'public/app/features/cmdb/partials/service_list.html',
    controller : 'ServiceListCtrl',
    resolve: loadCMDBBundle
  })
  .when('/cmdb/servicelist/servicedetail', {
    templateUrl: 'public/app/features/cmdb/partials/service_detail.html',
    controller : 'ServiceDetailCtrl',
    resolve: loadCMDBBundle
  })
  .when('/service_dependency', {
    templateUrl: 'public/app/features/service/partials/service_dep.html',
    controller : 'BuildDependCtrl',
    reloadOnSearch: true,
    resolve: loadServiceBundle,
  })
  .when('/styleguide/:page?', {
    controller: 'StyleGuideCtrl',
    controllerAs: 'ctrl',
    templateUrl: 'public/app/features/styleguide/styleguide.html',
  })
  .otherwise({
    templateUrl: 'public/app/partials/error.html',
    controller: 'ErrorCtrl'
  });
}

coreModule.config(setupAngularRoutes);
