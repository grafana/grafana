import { NavModelItem, NavSection } from '@grafana/data';
import config from 'app/core/config';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';

export const PMM_STT_PAGE: NavModelItem = {
  id: 'database-checks',
  icon: 'percona-database-checks',
  text: 'Advisor Checks',
  subTitle: 'Percona Advisor Checks',
  section: NavSection.Core,
  url: `${config.appSubUrl}/pmm-database-checks`,
  breadcrumbs: [
    {
      title: 'Advisor Checks',
      url: `${config.appSubUrl}/pmm-database-checks`,
    },
  ],
  children: [
    {
      id: 'failed-checks',
      text: 'Failed Checks',
      url: `${config.appSubUrl}/pmm-database-checks/failed-checks`,
      hideFromMenu: true,
    },
    {
      id: 'all-checks',
      text: 'All Checks',
      url: `${config.appSubUrl}/pmm-database-checks/all-checks`,
      hideFromMenu: true,
    },
  ],
};

export const PMM_DBAAS_PAGE: NavModelItem = {
  id: 'dbaas',
  text: 'DBaaS',
  subTitle: 'Percona DBaaS',
  icon: 'database',
  section: NavSection.Core,
  url: `${config.appSubUrl}/dbaas`,
  breadcrumbs: [
    {
      title: 'DBaaS',
      url: `${config.appSubUrl}/dbaas`,
    },
  ],
  children: [
    {
      id: 'dbclusters',
      text: 'DB Cluster',
      url: `${config.appSubUrl}/dbaas/dbclusters`,
      hideFromMenu: true,
    },
    {
      id: 'kubernetes',
      text: 'Kubernetes Cluster',
      url: `${config.appSubUrl}/dbaas/kubernetes`,
      hideFromMenu: true,
    },
  ],
};

export const PMM_BACKUP_PAGE: NavModelItem = {
  id: 'backup',
  icon: 'history',
  text: 'Backup',
  subTitle: 'Percona Backups',
  url: `${config.appSubUrl}/backup`,
  section: NavSection.Core,
  breadcrumbs: [
    {
      title: 'Backup',
      url: `${config.appSubUrl}/backup`,
    },
  ],
  children: [
    {
      id: 'backup-inventory',
      text: 'All Backups',
      url: `${config.appSubUrl}/backup/inventory`,
      hideFromMenu: true,
    },
    {
      id: 'scheduled-backups',
      text: 'Scheduled Backup Jobs',
      url: `${config.appSubUrl}/backup/scheduled`,
      hideFromMenu: true,
    },
    {
      id: 'restore-history',
      text: 'Restores',
      url: `${config.appSubUrl}/backup/restore`,
      hideFromMenu: true,
    },
    {
      id: 'storage-locations',
      text: 'Storage Locations',
      url: `${config.appSubUrl}/backup/locations`,
      hideFromMenu: true,
    },
  ],
};

export const PMM_ALERTING_PERCONA_ALERTS: NavModelItem[] = [
  {
    id: 'integrated-alerting-alerts',
    text: 'Fired alerts',
    icon: 'info-circle',
    url: `${config.appSubUrl}/alerting/alerts`,
  },
  {
    id: 'integrated-alerting-templates',
    text: 'Alert rule templates',
    icon: 'brackets-curly',
    url: `${config.appSubUrl}/alerting/alert-rule-templates`,
  },
];

export const PMM_INVENTORY_PAGE: NavModelItem = {
  id: 'inventory',
  icon: 'percona-inventory',
  text: 'PMM Inventory',
  url: `${config.appSubUrl}/inventory`,
  subTitle: 'Percona PMM Inventory',
  breadcrumbs: [
    {
      title: 'PMM Inventory',
      url: `${config.appSubUrl}/inventory`,
    },
  ],
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
};

export const PMM_ADD_INSTANCE_PAGE: NavModelItem = {
  id: 'add-instance',
  url: `${config.appSubUrl}/add-instance`,
  icon: 'plus',
  subTitle: 'PMM Inventory',
  text: 'Add Instance to PMM',
  hideFromTabs: true,
  showIconInNavbar: true,
};

export const getPmmSettingsPage = (alertingEnabled = false): NavModelItem => {
  const children: NavModelItem[] = [
    {
      id: 'settings-metrics-resolution',
      text: 'Metrics Resolution',
      url: `${config.appSubUrl}/settings/metrics-resolution`,
    },
    {
      id: 'settings-advanced',
      text: 'Advanced Settings',
      url: `${config.appSubUrl}/settings/advanced-settings`,
    },
    {
      id: 'settings-ssh',
      text: 'SSH Key',
      url: `${config.appSubUrl}/settings/ssh-key`,
    },
    {
      id: 'settings-alert-manager',
      text: 'Alertmanager Integration',
      url: `${config.appSubUrl}/settings/am-integration`,
    },
    {
      id: 'settings-percona-platform',
      text: 'Percona Platform',
      url: `${config.appSubUrl}/settings/percona-platform`,
    },
  ];

  // TODO remove after integrating SMTP/slack with Grafana's alerting system
  // if (alertingEnabled) {
  //   children.push({
  //     id: 'settings-communication',
  //     text: 'Communication',
  //     url: `${config.appSubUrl}/settings/communication`,
  //   });
  // }
  const page: NavModelItem = {
    id: 'settings',
    icon: 'percona-setting',
    text: 'Settings',
    url: `${config.appSubUrl}/settings`,
    subTitle: 'Percona Settings',
    breadcrumbs: [
      {
        title: 'Settings',
        url: `${config.appSubUrl}/settings`,
      },
    ],
    children,
  };

  return page;
};

export const PMM_TICKETS_PAGE: NavModelItem = {
  id: 'tickets',
  icon: 'ticket',
  text: 'List of tickets opened by Customer Organization',
  subTitle: 'Percona Support Tickets from Portal',
  url: `${config.appSubUrl}/tickets`,
  section: NavSection.Core,
};

export const PMM_ENTITLEMENTS_PAGE: NavModelItem = {
  id: 'entitlements',
  icon: 'cloud',
  text: 'Entitlements',
  subTitle: 'Percona Entitlements',
  url: `${config.appSubUrl}/entitlements`,
  section: NavSection.Core,
};

export const PMM_ENVIRONMENT_OVERVIEW_PAGE: NavModelItem = {
  id: 'environment-overview',
  icon: 'clouds',
  text: 'Environment Overview',
  subTitle: 'Percona Environment Overview',
  url: `${config.appSubUrl}/environment-overview`,
  section: NavSection.Core,
};

/**
 * Mapping of menu items id to folders name.
 *
 * Folders are created based on the folder name in grafana-dashboards.
 */
export const NAV_FOLDER_MAP: Record<string, string> = {
  system: 'OS',
  mysql: 'MySQL',
  mongo: 'MongoDB',
  postgre: 'PostgreSQL',
};

export const NAV_ID_TO_SERVICE: Record<string, ServiceType> = {
  mysql: ServiceType.mysql,
  mongo: ServiceType.mongodb,
  postgre: ServiceType.posgresql,
  proxysql: ServiceType.proxysql,
  haproxy: ServiceType.haproxy,
};

// 5 mins
export const ACTIVE_SERVICE_TYPES_CHECK_INTERVAL_MS = 300000;
