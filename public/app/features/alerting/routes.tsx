import React from 'react';
import { Redirect } from 'react-router-dom';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';

const alertingRoutes = [
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
    path: '/alerting/routes/mute-timing/new',
    roles: () => ['Admin', 'Editor'],
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "MuteTimings" */ 'app/features/alerting/unified/MuteTimings')
    ),
  },
  {
    path: '/alerting/routes/mute-timing/:id/edit',
    oles: () => ['Admin', 'Editor'],
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "MuteTimings" */ 'app/features/alerting/unified/MuteTimings')
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
    roles: config.unifiedAlertingEnabled ? () => ['Editor', 'Admin'] : undefined,
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
      () => import(/* webpackChunkName: "NewNotificationChannel" */ 'app/features/alerting/NewNotificationChannelPage')
    ),
  },
  {
    path: '/alerting/notification/:id/edit',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "EditNotificationChannel"*/ 'app/features/alerting/EditNotificationChannelPage')
    ),
  },
  {
    path: '/alerting/groups/',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "AlertGroups" */ 'app/features/alerting/unified/AlertGroups')
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
    path: '/alerting/:sourceName/:id/view',
    pageClass: 'page-alerting',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "AlertingRule"*/ 'app/features/alerting/unified/RuleViewer')
    ),
  },
  {
    path: '/alerting/:sourceName/:name/find',
    pageClass: 'page-alerting',
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "AlertingRedirectToRule"*/ 'app/features/alerting/unified/RedirectToRuleViewer')
    ),
  },
  {
    path: '/alerting/admin',
    roles: () => ['Admin'],
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "AlertingAdmin" */ 'app/features/alerting/unified/Admin')
    ),
  },
];

export function getAlertingRoutes(cfg = config): RouteDescriptor[] {
  if (cfg.alertingEnabled || cfg.unifiedAlertingEnabled) {
    return alertingRoutes;
  }

  return alertingRoutes.map((route) => ({
    ...route,
    component: SafeDynamicImport(
      () => import(/* webpackChunkName: "Alerting feature toggle page"*/ 'app/features/alerting/FeatureTogglePage')
    ),
  }));
}
