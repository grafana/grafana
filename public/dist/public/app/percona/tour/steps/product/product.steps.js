import React from 'react';
import SidebarStep from 'app/percona/tour/components/SidebarStep';
import { Messages } from './product.messages';
import { getPMMDashboardsStep } from './product.utils';
export const getProductTourSteps = (isPmmAdmin = true, settings, activeServices) => [
    {
        selector: '.dropdown > [aria-label="Dashboards"]',
        content: (React.createElement(SidebarStep, { title: Messages.dashboards.title },
            React.createElement("p", null, Messages.dashboards.browse),
            React.createElement("p", null, Messages.dashboards.folders),
            React.createElement("p", null, Messages.dashboards.playlists))),
    },
    getPMMDashboardsStep(activeServices || []),
    {
        selector: '.dropdown > [aria-label="Query Analytics (QAN)"]',
        content: (React.createElement(SidebarStep, { title: Messages.qan.title },
            React.createElement("p", null, Messages.qan.queries),
            React.createElement("p", null, Messages.qan.analyze))),
    },
    ...(isPmmAdmin
        ? [
            {
                selector: '.dropdown > [aria-label="Explore"]',
                content: (React.createElement(SidebarStep, { title: Messages.explore.title },
                    React.createElement("p", null, Messages.explore.data),
                    React.createElement("p", null, Messages.explore.graphs),
                    React.createElement("p", null, Messages.explore.query))),
            },
        ]
        : []),
    {
        selector: '.dropdown > [aria-label="Alerting"]',
        content: (React.createElement(SidebarStep, { title: Messages.alerting.title },
            React.createElement("p", null,
                Messages.alerting.simplerToUse,
                React.createElement("strong", null, Messages.alerting.admin),
                Messages.alerting.thatWorks),
            React.createElement("p", null, Messages.alerting.youDefine),
            React.createElement("p", null, Messages.alerting.howToUse),
            React.createElement("p", null,
                Messages.alerting.moreInfo,
                React.createElement("a", { href: "https://per.co.na/alerting", target: "_blank", rel: "noreferrer noopener" }, Messages.alerting.docs),
                "."))),
    },
    ...(isPmmAdmin && !!(settings === null || settings === void 0 ? void 0 : settings.sttEnabled)
        ? [
            {
                selector: '.dropdown > [aria-label="Advisors"]',
                content: (React.createElement(SidebarStep, { title: Messages.advisors.title },
                    React.createElement("p", null, Messages.advisors.pmmIncludes),
                    React.createElement("p", null,
                        Messages.advisors.findOutMore,
                        React.createElement("a", { href: "https://per.co.na/advisors", target: "_blank", rel: "noreferrer noopener" }, Messages.advisors.docs),
                        "."))),
            },
        ]
        : []),
    ...(isPmmAdmin && !!(settings === null || settings === void 0 ? void 0 : settings.dbaasEnabled)
        ? [
            {
                selector: '.dropdown > [aria-label="DBaaS"]',
                content: (React.createElement(SidebarStep, { title: Messages.dbaas.title },
                    React.createElement("p", null, Messages.dbaas.feature),
                    React.createElement("p", null, Messages.dbaas.techPreview),
                    React.createElement("p", null, Messages.dbaas.benefits),
                    React.createElement("ul", null,
                        React.createElement("li", null, Messages.dbaas.singleInterface),
                        React.createElement("li", null, Messages.dbaas.dbManagement),
                        React.createElement("li", null, Messages.dbaas.automation)))),
            },
        ]
        : []),
    ...(isPmmAdmin && !!(settings === null || settings === void 0 ? void 0 : settings.backupEnabled)
        ? [
            {
                selector: '.dropdown > [aria-label="Backup"]',
                content: (React.createElement(SidebarStep, { title: Messages.backup.title },
                    React.createElement("p", null, Messages.backup.feature),
                    React.createElement("p", null, Messages.backup.onDemand),
                    React.createElement("p", null, Messages.backup.shedule))),
            },
        ]
        : []),
    ...(isPmmAdmin
        ? [
            {
                selector: '.dropdown > [aria-label="Configuration"]',
                content: (React.createElement(SidebarStep, { title: Messages.configPanel.title },
                    React.createElement("p", null, Messages.configPanel.services),
                    React.createElement("p", null, Messages.configPanel.settings),
                    React.createElement("p", null,
                        Messages.configPanel.settingsDocs,
                        ' ',
                        React.createElement("a", { href: "https://per.co.na/configure", target: "_blank", rel: "noreferrer noopener" }, Messages.configPanel.settingsDocsLink),
                        "."))),
            },
            {
                selector: '.dropdown > [aria-label="Server admin"]',
                content: (React.createElement(SidebarStep, { title: Messages.serverAdmin.title },
                    React.createElement("p", null, Messages.serverAdmin.userManagement),
                    React.createElement("ul", null,
                        React.createElement("li", null, Messages.serverAdmin.addEditRemove),
                        React.createElement("li", null, Messages.serverAdmin.grant),
                        React.createElement("li", null, Messages.serverAdmin.manageOrg),
                        React.createElement("li", null, Messages.serverAdmin.changeOrg)))),
            },
        ]
        : []),
];
export default getProductTourSteps;
//# sourceMappingURL=product.steps.js.map