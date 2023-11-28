import React from 'react';
import SidebarStep from 'app/percona/tour/components/SidebarStep';
import { Messages } from './alerting.messages';
export const getAlertingTourSteps = (isAdmin = false) => [
    ...(isAdmin
        ? [
            {
                selector: '[aria-label="Tab Fired alerts"]',
                mutationObservables: ['.page-body'],
                resizeObservables: ['.page-body'],
                content: (React.createElement(SidebarStep, { title: Messages.firedAlerts.title },
                    React.createElement("p", null, Messages.firedAlerts.view),
                    React.createElement("p", null, Messages.firedAlerts.check))),
            },
            {
                selector: '[aria-label="Tab Alert rule templates"]',
                content: (React.createElement(SidebarStep, { title: Messages.alertRuleTemplates.title },
                    React.createElement("p", null, Messages.alertRuleTemplates.effortlessly),
                    React.createElement("p", null, Messages.alertRuleTemplates.offers))),
            },
        ]
        : []),
    {
        selector: '[aria-label="Tab Alert rules"]',
        content: (React.createElement(SidebarStep, { title: Messages.alertRules.title },
            React.createElement("p", null, Messages.alertRules.rules),
            React.createElement("p", null, Messages.alertRules.start),
            React.createElement("p", null, Messages.alertRules.create))),
    },
    {
        selector: '[aria-label="Tab Contact points"]',
        content: (React.createElement(SidebarStep, { title: Messages.contactPoints.title },
            React.createElement("p", null, Messages.contactPoints.define),
            React.createElement("p", null, Messages.contactPoints.grafana))),
    },
    {
        selector: '[aria-label="Tab Notification policies"]',
        content: (React.createElement(SidebarStep, { title: Messages.notificationPolicies.title },
            React.createElement("p", null, Messages.notificationPolicies.routed),
            React.createElement("p", null, Messages.notificationPolicies.policy))),
    },
    {
        selector: '[aria-label="Tab Silences"]',
        content: (React.createElement(SidebarStep, { title: Messages.silences.title },
            React.createElement("p", null, Messages.silences.create),
            React.createElement("p", null, Messages.silences.silences))),
    },
    {
        selector: '[aria-label="Tab Alert groups"]',
        content: (React.createElement(SidebarStep, { title: Messages.alertGroups.title },
            React.createElement("p", null, Messages.alertGroups.alert),
            React.createElement("p", null, Messages.alertGroups.grouping))),
    },
    ...(isAdmin
        ? [
            {
                selector: '[aria-label="Tab Admin"]',
                content: (React.createElement(SidebarStep, { title: Messages.admin.title },
                    React.createElement("p", null, Messages.admin.configure))),
            },
        ]
        : []),
];
export default getAlertingTourSteps;
//# sourceMappingURL=alerting.steps.js.map