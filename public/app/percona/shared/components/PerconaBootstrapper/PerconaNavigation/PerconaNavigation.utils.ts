import { NavModelItem, NavSection } from '@grafana/data';
import { config } from 'app/core/config';
import { Settings } from 'app/percona/settings/Settings.types';
import { CategorizedAdvisor } from 'app/percona/shared/services/advisors/Advisors.types';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';
import { FolderDTO } from 'app/types';

import {
  NAV_FOLDER_MAP,
  NAV_ID_TO_SERVICE,
  PMM_ACCESS_ROLES_PAGE,
  PMM_ADD_INSTANCE_PAGE,
  PMM_ALERTING_PERCONA_ALERTS,
} from './PerconaNavigation.constants';

const DIVIDER: NavModelItem = {
  id: 'divider',
  text: 'Divider',
  divider: true,
  showDividerInExpanded: true,
  hideFromTabs: true,
};

export const buildIntegratedAlertingMenuItem = (mainLinks: NavModelItem[]): NavModelItem | undefined => {
  const alertingItem = mainLinks.find(({ id }) => id === 'alerting');

  if (alertingItem?.url) {
    alertingItem.url = `${config.appSubUrl}/alerting/alerts`;
  }

  alertingItem?.children?.unshift(...PMM_ALERTING_PERCONA_ALERTS);
  return alertingItem;
};

export const removeAlertingMenuItem = (mainLinks: NavModelItem[]) => {
  const alertingItem = mainLinks.find(({ id }) => id === 'alerting');

  PMM_ALERTING_PERCONA_ALERTS.forEach((alertingTab, idx) => {
    const item = alertingItem?.children?.find((c) => c.id === alertingTab.id);

    if (item) {
      alertingItem?.children?.splice(idx, 1);
    }
  });

  if (alertingItem?.url) {
    alertingItem.url = `${config.appSubUrl}/alerting/list`;
  }

  return alertingItem;
};

export const buildInventoryAndSettings = (mainLinks: NavModelItem[], settings?: Settings): NavModelItem[] => {
  const inventoryLink: NavModelItem = {
    id: 'inventory',
    icon: 'server-network',
    text: 'Inventory',
    url: `${config.appSubUrl}/inventory`,
    hideFromTabs: true,
  };
  const orgLink: NavModelItem = {
    id: 'main-organization',
    text: 'Organization',
    isSubheader: true,
  };
  const pmmLink: NavModelItem = {
    id: 'settings-pmm',
    text: 'PMM',
    isSubheader: true,
  };
  const settingsLink: NavModelItem = {
    id: 'settings',
    icon: 'percona-setting',
    text: 'Settings',
    url: `${config.appSubUrl}/settings`,
  };
  const configNode = mainLinks.find((link) => link.id === 'cfg');

  if (!configNode) {
    const cfgNode: NavModelItem = {
      id: 'cfg',
      text: 'Configuration',
      icon: 'cog',
      url: `${config.appSubUrl}/inventory`,
      subTitle: 'Configuration',
      children: [inventoryLink, settingsLink, DIVIDER, PMM_ADD_INSTANCE_PAGE],
    };
    if (settings?.enableAccessControl) {
      addAccessRolesLink(cfgNode);
    }
    mainLinks.push(cfgNode);
  } else {
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
    if (settings?.enableAccessControl) {
      addAccessRolesLink(configNode);
    }
  }

  return mainLinks;
};

export const addAccessRolesLink = (configNode: NavModelItem) => {
  if (configNode.children) {
    const usersIdx = configNode.children.findIndex((item) => item.id === 'users');
    configNode.children = [
      ...configNode.children.slice(0, usersIdx + 1),
      PMM_ACCESS_ROLES_PAGE,
      ...configNode.children.slice(usersIdx + 1),
    ];
  }
};

export const addFolderLinks = (navTree: NavModelItem[], folders: FolderDTO[]) => {
  for (const rootNode of navTree) {
    const folder = folders.find((f) => rootNode.id && NAV_FOLDER_MAP[rootNode.id] === f.title);

    if (folder) {
      rootNode.children?.push({
        id: rootNode.id + '-other-dashboards',
        icon: 'search',
        text: 'Other dashboards',
        showIconInNavbar: true,
        url: `/graph/dashboards/f/${folder.uid}/${rootNode.id}`,
      });
    }
  }
};

export const filterByServices = (navTree: NavModelItem[], activeServices: ServiceType[]): NavModelItem[] => {
  const showNavLink = (node: NavModelItem) => {
    if (node.id) {
      const serviceType = NAV_ID_TO_SERVICE[node.id];
      return !serviceType || activeServices.some((s) => s === serviceType);
    }

    return true;
  };

  return navTree.filter(showNavLink);
};

export const buildAdvisorsNavItem = (categorizedAdvisors: CategorizedAdvisor) => {
  const modelItem: NavModelItem = {
    id: `advisors`,
    icon: 'percona-database-checks',
    text: 'Advisors',
    subTitle: 'Run and analyze all checks',
    url: `${config.appSubUrl}/advisors`,
    section: NavSection.Core,
    children: [],
  };
  const categories = Object.keys(categorizedAdvisors);

  modelItem.children!.push({
    id: 'advisors-insights',
    text: 'Advisor Insights',
    url: `${config.appSubUrl}/advisors/insights`,
  });

  categories.forEach((category) => {
    modelItem.children!.push({
      id: `advisors-${category}`,
      text: `${category[0].toUpperCase()}${category.substring(1)} Advisors`,
      url: `${config.appSubUrl}/advisors/${category}`,
    });
  });

  return modelItem;
};
