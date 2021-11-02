import { __assign } from "tslib";
import React from 'react';
import { Redirect } from 'react-router-dom';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
var alertingRoutes = [
    {
        path: '/alerting',
        // eslint-disable-next-line react/display-name
        component: function () { return React.createElement(Redirect, { to: "/alerting/list" }); },
    },
    {
        path: '/alerting/list',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertRuleListIndex" */ 'app/features/alerting/AlertRuleListIndex'); }),
    },
    {
        path: '/alerting/ng/list',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertRuleList" */ 'app/features/alerting/AlertRuleList'); }),
    },
    {
        path: '/alerting/routes',
        roles: function () { return ['Admin', 'Editor']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertAmRoutes" */ 'app/features/alerting/unified/AmRoutes'); }),
    },
    {
        path: '/alerting/silences',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences'); }),
    },
    {
        path: '/alerting/silence/new',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences'); }),
    },
    {
        path: '/alerting/silence/:id/edit',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertSilences" */ 'app/features/alerting/unified/Silences'); }),
    },
    {
        path: '/alerting/notifications',
        roles: config.unifiedAlertingEnabled ? function () { return ['Editor', 'Admin']; } : undefined,
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notifications/templates/new',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notifications/templates/:id/edit',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notifications/receivers/new',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notifications/receivers/:id/edit',
        roles: function () { return ['Editor', 'Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notifications/global-config',
        roles: function () { return ['Admin', 'Editor']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NotificationsListPage" */ 'app/features/alerting/NotificationsIndex'); }),
    },
    {
        path: '/alerting/notification/new',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "NewNotificationChannel" */ 'app/features/alerting/NewNotificationChannelPage'); }),
    },
    {
        path: '/alerting/notification/:id/edit',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "EditNotificationChannel"*/ 'app/features/alerting/EditNotificationChannelPage'); }),
    },
    {
        path: '/alerting/groups/',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertGroups" */ 'app/features/alerting/unified/AlertGroups'); }),
    },
    {
        path: '/alerting/new',
        pageClass: 'page-alerting',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor'); }),
    },
    {
        path: '/alerting/:id/edit',
        pageClass: 'page-alerting',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertingRuleForm"*/ 'app/features/alerting/unified/RuleEditor'); }),
    },
    {
        path: '/alerting/:sourceName/:id/view',
        pageClass: 'page-alerting',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertingRule"*/ 'app/features/alerting/unified/RuleViewer'); }),
    },
    {
        path: '/alerting/:sourceName/:name/find',
        pageClass: 'page-alerting',
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertingRedirectToRule"*/ 'app/features/alerting/unified/RedirectToRuleViewer'); }),
    },
    {
        path: '/alerting/admin',
        roles: function () { return ['Admin']; },
        component: SafeDynamicImport(function () { return import(/* webpackChunkName: "AlertingAdmin" */ 'app/features/alerting/unified/Admin'); }),
    },
];
export function getAlertingRoutes(cfg) {
    if (cfg === void 0) { cfg = config; }
    if (cfg.alertingEnabled || cfg.unifiedAlertingEnabled) {
        return alertingRoutes;
    }
    return alertingRoutes.map(function (route) { return (__assign(__assign({}, route), { component: SafeDynamicImport(function () { return import(/* webpackChunkName: "Alerting feature toggle page"*/ 'app/features/alerting/FeatureTogglePage'); }) })); });
}
//# sourceMappingURL=routes.js.map