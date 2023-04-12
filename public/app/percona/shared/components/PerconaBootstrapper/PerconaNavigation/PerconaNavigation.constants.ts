import { NavModelItem, NavSection } from '@grafana/data';
import config from 'app/core/config';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';

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
    },
    {
      id: 'scheduled-backups',
      text: 'Scheduled Backup Jobs',
      url: `${config.appSubUrl}/backup/scheduled`,
    },
    {
      id: 'restore-history',
      text: 'Restores',
      url: `${config.appSubUrl}/backup/restore`,
    },
    {
      id: 'storage-locations',
      text: 'Storage Locations',
      url: `${config.appSubUrl}/backup/locations`,
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
  icon: 'server-network',
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
      id: 'inventory-nodes',
      text: 'Nodes',
      url: `${config.appSubUrl}/inventory/nodes`,
      hideFromMenu: true,
    },
  ],
};

export const PMM_HEADING_LINK: NavModelItem = {
  id: 'settings-pmm',
  text: 'PMM',
};

export const PMM_ADD_INSTANCE_PAGE: NavModelItem = {
  id: 'add-instance',
  url: `${config.appSubUrl}/add-instance`,
  icon: 'plus',
  subTitle: 'PMM Inventory',
  text: 'Add Service',
  hideFromTabs: true,
  showIconInNavbar: true,
};

export const PMM_ACCESS_ROLE_CREATE_PAGE: NavModelItem = {
  id: 'rbac-create-role',
  url: `${config.appSubUrl}/roles/create`,
  icon: 'plus',
  subTitle: 'Roles',
  text: 'Roles',
  hideFromTabs: false,
  showIconInNavbar: false,
};

export const PMM_ACCESS_ROLE_EDIT_PAGE: NavModelItem = {
  id: 'rbac-edit-role',
  url: `${config.appSubUrl}/roles/:id/create`,
  icon: 'plus',
  subTitle: 'Roles',
  text: 'Roles',
  hideFromTabs: false,
  showIconInNavbar: false,
};

export const PMM_ACCESS_ROLES_PAGE: NavModelItem = {
  id: 'rbac-roles',
  icon: 'user-square',
  url: `${config.appSubUrl}/roles`,
  text: 'Access Roles',
  hideFromTabs: false,
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
