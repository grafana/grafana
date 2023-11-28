import { NavSection } from '@grafana/data';
import { config } from 'app/core/config';
import { NAV_FOLDER_MAP, NAV_ID_TO_SERVICE, PMM_ACCESS_ROLES_PAGE, PMM_ADD_INSTANCE_PAGE, PMM_ALERTING_PERCONA_ALERTS, } from './PerconaNavigation.constants';
const DIVIDER = {
    id: 'divider',
    text: 'Divider',
    divider: true,
    showDividerInExpanded: true,
    hideFromTabs: true,
};
export const buildIntegratedAlertingMenuItem = (mainLinks) => {
    var _a;
    const alertingItem = mainLinks.find(({ id }) => id === 'alerting');
    if (alertingItem === null || alertingItem === void 0 ? void 0 : alertingItem.url) {
        alertingItem.url = `${config.appSubUrl}/alerting/alerts`;
    }
    (_a = alertingItem === null || alertingItem === void 0 ? void 0 : alertingItem.children) === null || _a === void 0 ? void 0 : _a.unshift(...PMM_ALERTING_PERCONA_ALERTS);
    return alertingItem;
};
export const removeAlertingMenuItem = (mainLinks) => {
    const alertingItem = mainLinks.find(({ id }) => id === 'alerting');
    PMM_ALERTING_PERCONA_ALERTS.forEach((alertingTab, idx) => {
        var _a, _b;
        const item = (_a = alertingItem === null || alertingItem === void 0 ? void 0 : alertingItem.children) === null || _a === void 0 ? void 0 : _a.find((c) => c.id === alertingTab.id);
        if (item) {
            (_b = alertingItem === null || alertingItem === void 0 ? void 0 : alertingItem.children) === null || _b === void 0 ? void 0 : _b.splice(idx, 1);
        }
    });
    if (alertingItem === null || alertingItem === void 0 ? void 0 : alertingItem.url) {
        alertingItem.url = `${config.appSubUrl}/alerting/list`;
    }
    return alertingItem;
};
export const buildInventoryAndSettings = (mainLinks, settings) => {
    const inventoryLink = {
        id: 'inventory',
        icon: 'server-network',
        text: 'Inventory',
        url: `${config.appSubUrl}/inventory`,
        hideFromTabs: true,
    };
    const orgLink = {
        id: 'main-organization',
        text: 'Organization',
        isSubheader: true,
    };
    const pmmLink = {
        id: 'settings-pmm',
        text: 'PMM',
        isSubheader: true,
    };
    const settingsLink = {
        id: 'settings',
        icon: 'percona-setting',
        text: 'Settings',
        url: `${config.appSubUrl}/settings`,
    };
    const configNode = mainLinks.find((link) => link.id === 'cfg');
    if (!configNode) {
        const cfgNode = {
            id: 'cfg',
            text: 'Configuration',
            icon: 'cog',
            url: `${config.appSubUrl}/inventory`,
            subTitle: 'Configuration',
            children: [inventoryLink, settingsLink, DIVIDER, PMM_ADD_INSTANCE_PAGE],
        };
        if (settings === null || settings === void 0 ? void 0 : settings.enableAccessControl) {
            addAccessRolesLink(cfgNode);
        }
        mainLinks.push(cfgNode);
    }
    else {
        if (!configNode.children) {
            configNode.children = [];
        }
        if (configNode.subTitle) {
            orgLink.text = configNode.subTitle || '';
            configNode.subTitle = '';
        }
        configNode.url = `${config.appSubUrl}/inventory`;
        configNode.children = [
            PMM_ADD_INSTANCE_PAGE,
            inventoryLink,
            settingsLink,
            pmmLink,
            DIVIDER,
            ...configNode.children,
            orgLink,
        ];
        if (settings === null || settings === void 0 ? void 0 : settings.enableAccessControl) {
            addAccessRolesLink(configNode);
        }
    }
    return mainLinks;
};
export const addAccessRolesLink = (configNode) => {
    if (configNode.children) {
        const usersIdx = configNode.children.findIndex((item) => item.id === 'users');
        configNode.children = [
            ...configNode.children.slice(0, usersIdx + 1),
            PMM_ACCESS_ROLES_PAGE,
            ...configNode.children.slice(usersIdx + 1),
        ];
    }
};
export const addFolderLinks = (navTree, folders) => {
    var _a;
    for (const rootNode of navTree) {
        const folder = folders.find((f) => rootNode.id && NAV_FOLDER_MAP[rootNode.id] === f.title);
        if (folder) {
            (_a = rootNode.children) === null || _a === void 0 ? void 0 : _a.push({
                id: rootNode.id + '-other-dashboards',
                icon: 'search',
                text: 'Other dashboards',
                showIconInNavbar: true,
                url: `/graph/dashboards/f/${folder.uid}/${rootNode.id}`,
            });
        }
    }
};
export const filterByServices = (navTree, activeServices) => {
    const showNavLink = (node) => {
        if (node.id) {
            const serviceType = NAV_ID_TO_SERVICE[node.id];
            return !serviceType || activeServices.some((s) => s === serviceType);
        }
        return true;
    };
    return navTree.filter(showNavLink);
};
export const buildAdvisorsNavItem = (categorizedAdvisors) => {
    const modelItem = {
        id: `advisors`,
        icon: 'percona-database-checks',
        text: 'Advisors',
        subTitle: 'Run and analyze all checks',
        url: `${config.appSubUrl}/advisors`,
        section: NavSection.Core,
        children: [],
    };
    const categories = Object.keys(categorizedAdvisors);
    modelItem.children.push({
        id: 'advisors-insights',
        text: 'Advisor Insights',
        url: `${config.appSubUrl}/advisors/insights`,
    });
    categories.forEach((category) => {
        modelItem.children.push({
            id: `advisors-${category}`,
            text: `${category[0].toUpperCase()}${category.substring(1)} Advisors`,
            url: `${config.appSubUrl}/advisors/${category}`,
        });
    });
    return modelItem;
};
//# sourceMappingURL=PerconaNavigation.utils.js.map