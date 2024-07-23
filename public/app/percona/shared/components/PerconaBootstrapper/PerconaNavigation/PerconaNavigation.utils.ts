import { NavModelItem } from '@grafana/data';
import { config } from 'app/core/config';
import { Settings } from 'app/percona/settings/Settings.types';
import { CategorizedAdvisor } from 'app/percona/shared/services/advisors/Advisors.types';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';
import { FolderDTO } from 'app/types';

import {
  NAV_FOLDER_MAP,
  PMM_NAV_HAPROXY,
  NAV_ID_TO_SERVICE,
  PMM_NAV_MONGO,
  PMM_NAV_MYSQL,
  PMM_NAV_POSTGRE,
  PMM_NAV_PROXYSQL,
  PMM_NAV_OS,
  PMM_ACCESS_ROLES_PAGE,
  PMM_ADD_INSTANCE_PAGE,
  PMM_ALERTING_PERCONA_ALERTS,
  WEIGHTS,
  PMM_ACCESS_ROLE_CREATE_PAGE,
  PMM_ADD_INSTANCE_CREATE_PAGE,
  getPmmSettingsPage,
  PMM_INVENTORY_PAGE,
  PMM_UPDATES_LINK,
} from './PerconaNavigation.constants';

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

export const buildInventoryAndSettings = (
  mainLinks: NavModelItem[],
  settings?: Settings,
  updateAvailable?: boolean
): NavModelItem[] => {
  const inventoryLink: NavModelItem = PMM_INVENTORY_PAGE;
  const orgLink: NavModelItem = {
    id: 'main-organization',
    text: 'Organization',
    isSection: true,
  };
  const settingsLink: NavModelItem = getPmmSettingsPage();
  const configNode = mainLinks.find((link) => link.id === 'cfg');
  const pmmConfigNode = mainLinks.find((link) => link.id === 'pmmcfg');

  PMM_UPDATES_LINK.showDot = updateAvailable;

  if (!pmmConfigNode) {
    const pmmcfgNode: NavModelItem = {
      id: 'pmmcfg',
      text: 'PMM Configuration',
      icon: 'percona-nav-logo',
      url: `${config.appSubUrl}/inventory`,
      subTitle: 'Configuration',
      children: [PMM_ADD_INSTANCE_PAGE, PMM_ADD_INSTANCE_CREATE_PAGE, inventoryLink, settingsLink, PMM_UPDATES_LINK],
      sortWeight: -800,
      showDot: updateAvailable,
    };
    mainLinks.push(pmmcfgNode);
  }

  if (!configNode) {
    const cfgNode: NavModelItem = {
      id: 'cfg',
      text: 'Configuration',
      icon: 'cog',
      url: `${config.appSubUrl}/admin`,
      subTitle: 'Configuration',
      children: [],
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
    configNode.url = `${config.appSubUrl}/admin`;
    if (settings?.enableAccessControl) {
      addAccessRolesLink(configNode);
    }
  }

  return mainLinks;
};

export const addAccessRolesLink = (configNode: NavModelItem) => {
  if (configNode.children) {
    const accessNode = configNode.children.find((item) => item.id === 'cfg/access');
    const general = configNode.children.find((item) => item.id === 'cfg/general');
    const plugins = configNode.children.find((item) => item.id === 'cfg/plugins');

    if (accessNode && accessNode.children) {
      accessNode.parentItem = configNode;
      const usersIdx = accessNode.children.findIndex((item) => item.id === 'global-users');
      PMM_ACCESS_ROLES_PAGE.parentItem = accessNode;
      accessNode.children = [
        ...accessNode.children.slice(0, usersIdx + 1),
        PMM_ACCESS_ROLES_PAGE,
        // Add to have a create action for adding a role
        PMM_ACCESS_ROLE_CREATE_PAGE,
        ...accessNode.children.slice(usersIdx + 1),
      ];
    }
    if (general && general.children) {
      general.parentItem = configNode;
    }
    if (plugins && plugins.children) {
      plugins.parentItem = configNode;
    }
  }
};

export const addFolderLinks = (navTree: NavModelItem[], folders: FolderDTO[]) => {
  for (const rootNode of navTree) {
    const id = rootNode.id + '-other-dashboards';
    const folder = folders.find((f) => rootNode.id && NAV_FOLDER_MAP[rootNode.id] === f.title);
    const exists = rootNode.children?.some((i) => i.id === id);

    if (folder && !exists) {
      rootNode.children?.push({
        id,
        icon: 'search',
        text: 'Other dashboards',
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
    sortWeight: WEIGHTS.alerting,
    subTitle: 'Run and analyze all checks',
    url: `${config.appSubUrl}/advisors`,
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

export const addDashboardsLinks = (items: NavModelItem[]) => {
  items.push(PMM_NAV_OS);
  items.push(PMM_NAV_MYSQL);
  items.push(PMM_NAV_MONGO);
  items.push(PMM_NAV_POSTGRE);
  items.push(PMM_NAV_PROXYSQL);
  items.push(PMM_NAV_HAPROXY);
};

export const sortNavigation = (items: NavModelItem[]) => {
  items.sort((a, b) => (a.sortWeight || 0) - (b.sortWeight || 0));
};
