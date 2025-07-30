import { NavModelItem } from '@grafana/data';
import config from 'app/core/config';
import { ServiceType } from 'app/percona/shared/services/services/Services.types';

export const WEIGHTS = {
  dashboards: -1700,
  alerting: -1500,
  config: -900,
};

export const PMM_BACKUP_PAGE: NavModelItem = {
  id: 'backup',
  icon: 'history',
  text: 'Backup',
  subTitle: 'Percona Backups',
  url: `${config.appSubUrl}/backup`,
  sortWeight: WEIGHTS.alerting,
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

export const PMM_ALERTING_CREATE_ALERT_TEMPLATE: NavModelItem = {
  id: 'integrated-alerting-new-from-template',
  text: 'Create alert rule from template',
  icon: 'brackets-curly',
  url: `${config.appSubUrl}/alerting/new-from-template`,
  hideFromTabs: true,
  isCreateAction: true,
};

export const PMM_ALERTING_FIRED_ALERTS: NavModelItem = {
  id: 'integrated-alerting-alerts',
  text: 'Fired alerts',
  icon: 'info-circle',
  url: `${config.appSubUrl}/alerting/alerts`,
};

export const PMM_ALERTING_RULE_TEMPLATES: NavModelItem = {
  id: 'integrated-alerting-templates',
  text: 'Alert rule templates',
  icon: 'brackets-curly',
  url: `${config.appSubUrl}/alerting/alert-rule-templates`,
};

export const PMM_ALERTING_PERCONA_ALERTS: NavModelItem[] = [
  PMM_ALERTING_FIRED_ALERTS,
  PMM_ALERTING_RULE_TEMPLATES,
  PMM_ALERTING_CREATE_ALERT_TEMPLATE,
];

export const PMM_SERVICES_PAGE: NavModelItem = {
  id: 'inventory-services',
  text: 'Services',
  url: `${config.appSubUrl}/inventory/services`,
};

export const PMM_NODES_PAGE: NavModelItem = {
  id: 'inventory-nodes',
  text: 'Nodes',
  url: `${config.appSubUrl}/inventory/nodes`,
};

export const PMM_INVENTORY_PAGE: NavModelItem = {
  id: 'inventory',
  icon: 'server-network',
  text: 'PMM Inventory',
  url: `${config.appSubUrl}/inventory`,
  subTitle: 'Percona PMM Inventory',
  children: [PMM_SERVICES_PAGE, PMM_NODES_PAGE],
};

export const PMM_UPDATES_LINK: NavModelItem = {
  id: 'pmm-updates',
  text: 'Updates',
  url: '/pmm-ui/updates',
  hideFromTabs: true,
  target: '_self',
  showDot: false,
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
};

/**
 * Add separate page with isCreateAction to show the item both in
 * navigation and "New" shortcut
 */
export const PMM_ADD_INSTANCE_CREATE_PAGE: NavModelItem = {
  ...PMM_ADD_INSTANCE_PAGE,
  text: 'Add service',
  isCreateAction: true,
};

export const PMM_EXPORT_DUMP_PAGE: NavModelItem = {
  id: 'pmm-dump-export',
  url: `${config.appSubUrl}/pmm-dump/new`,
  text: 'Export new dataset',
};

export const PMM_DUMP_PAGE: NavModelItem = {
  id: 'pmm-dump',
  url: `${config.appSubUrl}/pmm-dump`,
  icon: 'brain',
  subTitle:
    'Simplify troubleshooting and accelerate issue resolution by securely sharing relevant data, ensuring a smoother support experience.',
  text: 'PMM Dump',
  children: [PMM_EXPORT_DUMP_PAGE],
};

export const PMM_EDIT_INSTANCE_PAGE: NavModelItem = {
  id: 'edit-instance',
  url: `${config.appSubUrl}/edit-instance`,
  text: 'Edit Instance',
  hideFromTabs: true,
};

export const PMM_ACCESS_ROLE_CREATE_PAGE: NavModelItem = {
  id: 'rbac-create-role',
  url: `${config.appSubUrl}/roles/create`,
  icon: 'plus',
  text: 'Create role',
  hideFromTabs: true,
  isCreateAction: true,
};

export const PMM_ACCESS_ROLE_EDIT_PAGE: NavModelItem = {
  id: 'rbac-edit-role',
  url: `${config.appSubUrl}/roles/:id/edit`,
  icon: 'plus',
  text: 'Edit role',
  hideFromTabs: true,
};

export const PMM_ACCESS_ROLES_PAGE: NavModelItem = {
  id: 'rbac-roles',
  icon: 'user-square',
  url: `${config.appSubUrl}/roles`,
  text: 'Access Roles',
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
};

export const PMM_ENTITLEMENTS_PAGE: NavModelItem = {
  id: 'entitlements',
  icon: 'cloud',
  text: 'Entitlements',
  subTitle: 'Percona Entitlements',
  url: `${config.appSubUrl}/entitlements`,
};

export const PMM_ENVIRONMENT_OVERVIEW_PAGE: NavModelItem = {
  id: 'environment-overview',
  icon: 'clouds',
  text: 'Environment Overview',
  subTitle: 'Percona Environment Overview',
  url: `${config.appSubUrl}/environment-overview`,
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

  children: [
    {
      id: 'node-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/node-instance-overview/nodes-overview`,
      hideFromTabs: true,
    },
    {
      id: 'node-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/node-instance-summary/node-summary`,
      hideFromTabs: true,
    },
    {
      id: 'cpu-utilization',
      text: 'CPU utilization',
      icon: 'percona-cpu',
      url: `${config.appSubUrl}/d/node-cpu/cpu-utilization-details`,
      hideFromTabs: true,
    },
    {
      id: 'disk',
      text: 'Disk',
      icon: 'percona-disk',
      url: `${config.appSubUrl}/d/node-disk/disk-details`,
      hideFromTabs: true,
    },
    {
      id: 'memory',
      text: 'Memory',
      icon: 'percona-memory',
      url: `${config.appSubUrl}/d/node-memory/memory-details`,
      hideFromTabs: true,
    },
    {
      id: 'network',
      text: 'Network',
      icon: 'percona-network',
      url: `${config.appSubUrl}/d/node-network/network-details`,
      hideFromTabs: true,
    },
    {
      id: 'temperature',
      text: 'Temperature',
      icon: 'percona-temperature',
      url: `${config.appSubUrl}/d/node-temp/node-temperature-details`,
      hideFromTabs: true,
    },
    {
      id: 'numa',
      text: 'NUMA',
      icon: 'percona-cluster-network',
      url: `${config.appSubUrl}/d/node-memory-numa/numa-details`,
      hideFromTabs: true,
    },
    {
      id: 'processes',
      text: 'Processes',
      icon: 'percona-process',
      url: `${config.appSubUrl}/d/node-cpu-process/processes-details`,
      hideFromTabs: true,
    },
  ],
};

export const PMM_NAV_MYSQL: NavModelItem = {
  id: 'mysql',
  text: 'MySQL',
  icon: 'percona-database-mysql',
  url: `${config.appSubUrl}/d/mysql-instance-overview/mysql-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,

  children: [
    {
      id: 'mysql-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/mysql-instance-overview/mysql-instances-overview`,
      hideFromTabs: true,
    },
    {
      id: 'mysql-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/mysql-instance-summary/mysql-instance-summary`,
      hideFromTabs: true,
    },
    {
      id: 'mysql-ha',
      text: 'High availability',
      icon: 'percona-cluster',
      hideFromTabs: true,
      showChildren: true,
      url: `${config.appSubUrl}/d/mysql-group-replicaset-summary`,
      children: [
        {
          id: 'mysql-group-replication-summary',
          text: 'Group replication summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mysql-group-replicaset-summary/mysql-group-replication-summary`,
          hideFromTabs: true,
        },
        {
          id: 'mysql-replication-summary',
          text: 'Replication summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mysql-replicaset-summary/mysql-replication-summary`,
          hideFromTabs: true,
        },
        {
          id: 'pxc-cluster-summary',
          text: 'PXC/Galera cluster summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-cluster-summary/pxc-galera-cluster-summary`,
          hideFromTabs: true,
        },
        {
          id: 'pxc-node-summary',
          text: 'PXC/Galera node summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-node-summary/pxc-galera-node-summary`,
          hideFromTabs: true,
        },
        {
          id: 'pxc-nodes-compare',
          text: 'PXC/Galera nodes compare',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/pxc-nodes-compare/pxc-galera-nodes-compare`,
          hideFromTabs: true,
        },
      ],
    },
    {
      id: 'mysql-command-handler-counters-compare',
      text: 'Command/Handler counters compare',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-commandhandler-compare/mysql-command-handler-counters-compare`,
    },
    {
      id: 'mysql-innodb-details',
      text: 'InnoDB details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-innodb/mysql-innodb-details`,
    },
    {
      id: 'mysql-innodb-compression-details',
      text: 'InnoDB compression',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-innodb-compression/mysql-innodb-compression-details`,
    },
    {
      id: 'mysql-performance-schema-details',
      text: 'Performance schema',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-performance-schema/mysql-performance-schema-details`,
    },
    {
      id: 'mysql-query-response-time-details',
      text: 'Query response time',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-queryresponsetime/mysql-query-response-time-details`,
    },
    {
      id: 'mysql-table-details',
      text: 'Table details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-table/mysql-table-details`,
    },
    {
      id: 'mysql-tokudb-details',
      text: 'TokuDB details',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mysql-tokudb/mysql-tokudb-details`,
    },
  ],
};

export const PMM_NAV_MONGO: NavModelItem = {
  id: 'mongo',
  text: 'MongoDB',
  icon: 'percona-database-mongodb',
  url: `${config.appSubUrl}/d/mongodb-instance-overview/mongodb-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,

  children: [
    {
      id: 'mongo-overview',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/mongodb-instance-overview/mongodb-instances-overview`,
      hideFromTabs: true,
    },
    {
      id: 'mongo-summary',
      text: 'Instance Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/mongodb-instance-summary/mongodb-instance-summary`,
      hideFromTabs: true,
    },
    {
      id: 'mongo-ha',
      text: 'High availability',
      icon: 'percona-cluster',
      hideFromTabs: true,
      showChildren: true,
      url: `${config.appSubUrl}/d/mongodb-cluster-summary`,
      children: [
        {
          id: 'mongo-cluster-summary',
          text: 'Cluster summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mongodb-cluster-summary/mongodb-sharded-cluster-summary`,
          hideFromTabs: true,
        },
        {
          id: 'mongo-rplset-summary',
          text: 'ReplSet summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mongodb-replicaset-summary/mongodb-replset-summary`,
          hideFromTabs: true,
        },
        {
          id: 'mongo-router-summary',
          text: 'Router summary',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/mongodb-router-summary/mongodb-router-summary`,
          hideFromTabs: true,
        },
      ],
    },
    {
      id: 'mongo-pbm-details',
      text: 'Backup Status',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-pbm-details/mongodb-pbm-details`,
      hideFromTabs: true,
    },
    {
      id: 'mongo-collections-overview',
      text: 'Collections',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-collections-overview/mongodb-collections-overview`,
      hideFromTabs: true,
    },
    {
      id: 'mongo-oplog-details',
      text: 'Oplog',
      icon: 'sitemap',
      url: `${config.appSubUrl}/d/mongodb-oplog-details/mongodb-oplog-details`,
      hideFromTabs: true,
    },
  ],
};

export const PMM_NAV_POSTGRE: NavModelItem = {
  id: 'postgre',
  text: 'PostgreSQL',
  icon: 'percona-database-postgresql',
  url: `${config.appSubUrl}/d/postgresql-instance-overview/postgresql-instances-overview`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
  children: [
    {
      id: 'postgre-overwiew',
      text: 'Overview',
      icon: 'percona-nav-overview',
      url: `${config.appSubUrl}/d/postgresql-instance-overview/postgresql-instances-overview`,
      hideFromTabs: true,
    },
    {
      id: 'postgre-summary',
      text: 'Summary',
      icon: 'percona-nav-summary',
      url: `${config.appSubUrl}/d/postgresql-instance-summary/postgresql-instance-summary`,
      hideFromTabs: true,
    },
    {
      id: 'postgre-ha',
      text: 'High availability',
      icon: 'percona-cluster',
      hideFromTabs: true,
      showChildren: true,
      url: `${config.appSubUrl}/d/postgresql-replication-overview`,
      children: [
        {
          id: 'postgre-replication',
          text: 'Replication',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/postgresql-replication-overview/postgresql-replication-overview`,
          hideFromTabs: true,
        },
        {
          id: 'postgre-patroni',
          text: 'Patroni',
          icon: 'percona-cluster',
          url: `${config.appSubUrl}/d/postgresql-patroni-details/postgresql-patroni-details`,
          hideFromTabs: true,
        },
      ],
    },
    {
      id: 'postgre-top-queries',
      text: 'Top queries',
      url: `${config.appSubUrl}/d/postgresql-top-queries/postgresql-top-queries`,
      hideFromTabs: true,
    },
  ],
};

export const PMM_NAV_PROXYSQL: NavModelItem = {
  id: 'proxysql',
  text: 'ProxySQL',
  icon: 'percona-database-proxysql',
  url: `${config.appSubUrl}/d/proxysql-instance-summary/proxysql-instance-summary`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
};

export const PMM_NAV_HAPROXY: NavModelItem = {
  id: 'haproxy',
  text: 'HAProxy',
  icon: 'percona-database-haproxy',
  url: `${config.appSubUrl}/d/haproxy-instance-summary/haproxy-instance-summary`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
};

export const PMM_NAV_QAN: NavModelItem = {
  id: 'qan',
  text: 'Query Analytics (QAN)',
  icon: 'qan-logo',
  url: `${config.appSubUrl}/d/pmm-qan/pmm-query-analytics`,
  sortWeight: WEIGHTS.dashboards,
  hideFromTabs: true,
};
