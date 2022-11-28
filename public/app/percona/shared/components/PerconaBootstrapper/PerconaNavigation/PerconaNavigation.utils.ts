import { NavModelItem } from '@grafana/data';
import { config } from 'app/core/config';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';
import { FolderDTO } from 'app/types';

import {
  NAV_FOLDER_MAP,
  NAV_ID_TO_SERVICE,
  PMM_ADD_INSTANCE_PAGE,
  PMM_ALERTING_PERCONA_ALERTS,
} from './PerconaNavigation.constants';

const DIVIDER = {
  id: 'divider',
  text: 'Divider',
  divider: true,
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

export const buildInventoryAndSettings = (mainLinks: NavModelItem[]): NavModelItem[] => {
  const inventoryLink: NavModelItem = {
    id: 'inventory',
    icon: 'percona-inventory',
    text: 'PMM Inventory',
    url: `${config.appSubUrl}/inventory`,
    children: [
      {
        id: 'inventory-list',
        url: `${config.appSubUrl}/inventory`,
        icon: 'percona-inventory',
        text: 'Inventory List',
        hideFromTabs: true,
        children: [
          {
            id: 'inventory-services',
            text: 'Services',
            url: `${config.appSubUrl}/inventory/services`,
            hideFromMenu: true,
          },
          {
            id: 'inventory-agents',
            text: 'Agents',
            url: `${config.appSubUrl}/inventory/agents`,
            hideFromMenu: true,
          },
          {
            id: 'inventory-nodes',
            text: 'Nodes',
            url: `${config.appSubUrl}/inventory/nodes`,
            hideFromMenu: true,
          },
        ],
      },
    ],
  };
  const settingsLink: NavModelItem = {
    id: 'settings',
    icon: 'percona-setting',
    text: 'PMM Settings',
    url: `${config.appSubUrl}/settings`,
  };
  const configNode = mainLinks.find((link) => link.id === 'cfg');

  if (!configNode) {
    mainLinks.push({
      id: 'cfg',
      text: 'Configuration',
      icon: 'cog',
      url: `${config.appSubUrl}/inventory`,
      subTitle: 'Configuration',
      children: [inventoryLink, settingsLink, DIVIDER, PMM_ADD_INSTANCE_PAGE],
    });
  } else {
    if (!configNode.children) {
      configNode.children = [];
    }
    configNode.url = `${config.appSubUrl}/inventory`;
    configNode.children.unshift(PMM_ADD_INSTANCE_PAGE, DIVIDER, inventoryLink, settingsLink);
  }

  return mainLinks;
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
