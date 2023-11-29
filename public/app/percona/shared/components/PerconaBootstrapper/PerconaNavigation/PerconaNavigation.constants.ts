import { NavModelItem, NavSection } from '@grafana/data';
import config from 'app/core/config';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';

export const WEIGHTS = {
  dashboards: -1700,
  alerting: -1500,
  config: -900,
};

export const PMM_DBAAS_PAGE: NavModelItem = {
  id: 'dbaas',
  text: 'DBaaS',
  subTitle: 'Percona DBaaS',
  icon: 'database',
  section: NavSection.Core,
  url: `${config.appSubUrl}/dbaas`,
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
  sortWeight: WEIGHTS.alerting,
  section: NavSection.Core,
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

export const PMM_EDIT_INSTANCE_PAGE: NavModelItem = {
  id: 'edit-instance',
  url: `${config.appSubUrl}/edit-instance`,
  text: 'Edit Instance',
  hideFromTabs: true,
  showIconInNavbar: false,
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
    sortWeight: WEIGHTS.config,
    url: `${config.appSubUrl}/settings`,
    subTitle: 'Percona Settings',
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

export const PMM_NAV_OS: NavModelItem = {
  id: 'system',
  text: 'Operating System (OS)',
  icon: 'percona-system',
  url: `${config.appSubUrl}/d/node-instance-overview/nodes-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  children: [
    {
      id: 'node-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/node-instance-overview/nodes-overview`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'node-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/node-instance-summary/node-summary`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'cpu-utilization',
      text: 'CPU utilization',
      icon: 'percona-cpu',
      url: `${config.appSubUrl}/d/node-cpu/cpu-utilization-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'disk',
      text: 'Disk',
      icon: 'percona-disk',
      url: `${config.appSubUrl}/d/node-disk/disk-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'memory',
      text: 'Memory',
      icon: 'percona-memory',
      url: `${config.appSubUrl}/d/node-memory/memory-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'network',
      text: 'Network',
      icon: 'percona-network',
      url: `${config.appSubUrl}/d/node-network/network-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'temperature',
      text: 'Temperature',
      icon: 'percona-temperature',
      url: `${config.appSubUrl}/d/node-temp/node-temperature-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'numa',
      text: 'NUMA',
      icon: 'percona-cluster-network',
      url: `${config.appSubUrl}/d/node-memory-numa/numa-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'processes',
      text: 'Processes',
      icon: 'percona-process',
      url: `${config.appSubUrl}/d/node-cpu-process/processes-details`,
      hideFromTabs: true,
      expanded: false,
    },
  ],
  expanded: false,
};

export const PMM_NAV_MYSQL: NavModelItem = {
  id: 'mysql',
  text: 'MySQL',
  icon: 'percona-database-mysql',
  url: `${config.appSubUrl}/d/mysql-instance-overview/mysql-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  children: [
    {
      id: 'mysql-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/mysql-instance-overview/mysql-instances-overview`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'mysql-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/mysql-instance-summary/mysql-instance-summary`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'mysql-ha',
      text: 'High availability',
      icon: 'percona-cluster',
      hideFromTabs: true,
      showIconInNavbar: true,
      children: [
        {
          id: 'mysql-group-replication-summary',
          text: 'Group replication summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mysql-group-replicaset-summary/mysql-group-replication-summary`,
          hideFromTabs: true,
          expanded: false,
        },
        {
          id: 'mysql-replication-summary',
          text: 'Replication summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mysql-replicaset-summary/mysql-replication-summary`,
          hideFromTabs: true,
          expanded: false,
        },
        {
          id: 'pxc-cluster-summary',
          text: 'PXC/Galera cluster summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-cluster-summary/pxc-galera-cluster-summary`,
          hideFromTabs: true,
          expanded: false,
        },
        {
          id: 'pxc-node-summary',
          text: 'PXC/Galera node summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-node-summary/pxc-galera-node-summary`,
          hideFromTabs: true,
          expanded: false,
        },
        {
          id: 'pxc-nodes-compare',
          text: 'PXC/Galera nodes compare',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-nodes-compare/pxc-galera-nodes-compare`,
          hideFromTabs: true,
          expanded: false,
        },
      ],
      expanded: false,
    },
    {
      id: 'mysql-command-handler-counters-compare',
      text: 'Command/Handler counters compare',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare`,
      expanded: false,
    },
    {
      id: 'mysql-innodb-details',
      text: 'InnoDB details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-innodb/mysql-innodb-details`,
      expanded: false,
    },
    {
      id: 'mysql-innodb-compression-details',
      text: 'InnoDB compression',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-innodb-compression/mysql-innodb-compression-details`,
      expanded: false,
    },
    {
      id: 'mysql-performance-schema-details',
      text: 'Performance schema',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-performance-schema/mysql-performance-schema-details`,
      expanded: false,
    },
    {
      id: 'mysql-query-response-time-details',
      text: 'Query response time',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-queryresponsetime/mysql-query-response-time-details`,
      expanded: false,
    },
    {
      id: 'mysql-table-details',
      text: 'Table details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-table/mysql-table-details`,
      expanded: false,
    },
    {
      id: 'mysql-tokudb-details',
      text: 'TokuDB details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-tokudb/mysql-tokudb-details`,
      expanded: false,
    },
  ],
  expanded: false,
};

export const PMM_NAV_MONGO: NavModelItem = {
  id: 'mongo',
  text: 'MongoDB',
  icon: 'percona-database-mongodb',
  url: `${config.appSubUrl}/d/mongodb-instance-overview/mongodb-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  children: [
    {
      id: 'mongo-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/mongodb-instance-overview/mongodb-instances-overview`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'mongo-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/mongodb-instance-summary/mongodb-instance-summary`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'mongo-ha',
      text: 'High availability',
      icon: 'percona-cluster',
      hideFromTabs: true,
      showIconInNavbar: true,
      children: [
        {
          id: 'mongo-cluster-summary',
          text: 'Cluster summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mongodb-cluster-summary/mongodb-cluster-summary`,
          hideFromTabs: true,
          expanded: false,
        },
        {
          id: 'mongo-rplset-summary',
          text: 'ReplSet summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mongodb-replicaset-summary/mongodb-replset-summary`,
          hideFromTabs: true,
          expanded: false,
        },
      ],
      expanded: false,
    },
    {
      id: 'mongo-memory-details',
      text: 'InMemory',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-inmemory/mongodb-inmemory-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'mongo-mmap-details',
      text: 'MMAPv1',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-mmapv1/mongodb-mmapv1-details`,
      hideFromTabs: true,
      expanded: false,
    },
    {
      id: 'mondo-wiredtiger-details',
      text: 'WiredTiger',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-wiredtiger/mongodb-wiredtiger-details`,
      hideFromTabs: true,
      expanded: false,
    },
  ],
  expanded: false,
};

export const PMM_NAV_POSTGRE: NavModelItem = {
  id: 'postgre',
  text: 'PostgreSQL',
  icon: 'percona-database-postgresql',
  url: `${config.appSubUrl}/d/postgresql-instance-overview/postgresql-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  children: [
    {
      id: 'postgre-overwiew',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/postgresql-instance-overview/postgresql-instances-overview`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
    {
      id: 'postgre-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/postgresql-instance-summary/postgresql-instance-summary`,
      hideFromTabs: true,
      showIconInNavbar: true,
      expanded: false,
    },
  ],
  expanded: false,
};

export const PMM_NAV_PROXYSQL: NavModelItem = {
  id: 'proxysql',
  text: 'ProxySQL',
  icon: 'percona-database-proxysql',
  url: `${config.appSubUrl}/d/proxysql-instance-summary/proxysql-instance-summary`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  expanded: false,
};

export const PMM_NAV_HAPROXY: NavModelItem = {
  id: 'haproxy',
  text: 'HAProxy',
  icon: 'percona-database-haproxy',
  url: `${config.appSubUrl}/d/haproxy-instance-summary/haproxy-instance-summary`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  showIconInNavbar: true,
  expanded: false,
};

export const PMM_NAV_QAN: NavModelItem = {
  id: 'qan',
  text: 'Query Analytics (QAN)',
  icon: 'qan-logo',
  url: `${config.appSubUrl}/d/pmm-qan/pmm-query-analytics`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  expanded: false,
};
