import { servicesDetailsRender, agentsDetailsRender, nodesDetailsRender } from './ColumnRenderers';

export const MAIN_COLUMN = ['service_id', 'type', 'service_name', 'custom_labels', 'node_id', 'address', 'port'];

export const SERVICES_COLUMNS = [
  {
    Header: 'ID',
    accessor: 'service_id',
  },
  {
    Header: 'Service Type',
    accessor: 'type',
  },
  {
    Header: 'Service name',
    accessor: 'service_name',
  },
  {
    Header: 'Node ID',
    accessor: 'node_id',
  },
  {
    Header: 'Addresses',
    accessor: 'address',
  },
  {
    Header: 'Port',
    accessor: 'port',
  },
  {
    Header: 'Other Details',
    accessor: servicesDetailsRender,
  },
];

export const AGENTS_COLUMNS = [
  {
    Header: 'ID',
    accessor: 'agent_id',
  },
  {
    Header: 'Agent Type',
    accessor: 'type',
  },
  {
    Header: 'Other Details',
    accessor: agentsDetailsRender,
  },
];

export const NODES_COLUMNS = [
  {
    Header: 'ID',
    accessor: 'node_id',
  },
  {
    Header: 'Node Type',
    accessor: 'type',
  },
  {
    Header: 'Node Name',
    accessor: 'node_name',
  },
  {
    Header: 'Addresses',
    accessor: 'address',
  },
  {
    Header: 'Other Details',
    accessor: nodesDetailsRender,
  },
];

export const inventoryTypes = {
  amazon_rds_mysql: 'Amazon RDS MySQL',
  container: 'Container',
  external_exporter: 'External exporter',
  external: 'External',
  generic: 'Generic',
  mongodb_exporter: 'MongoDB exporter',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  haproxy: 'HAProxy',
  mysqld_exporter: 'MySQL exporter',
  node_exporter: 'Node exporter',
  pmm_agent: 'PMM Agent',
  vm_agent: 'VictoriaMetrics vmagent',
  postgres_exporter: 'Postgres exporter',
  postgresql: 'PostgreSQL',
  proxysql_exporter: 'ProxySQL exporter',
  proxysql: 'ProxySQL',
  qan_mongodb_profiler_agent: 'QAN MongoDB Profiler Agent',
  qan_mysql_perfschema_agent: 'QAN MySQL Perfschema Agent',
  qan_mysql_slowlog_agent: 'QAN MySQL Slowlog Agent',
  qan_postgresql_pgstatements_agent: 'QAN PostgreSQL PgStatements Agent',
  qan_postgresql_pgstatmonitor_agent: 'QAN PostgreSQL Pgstatmonitor Agent',
  rds_exporter: 'RDS exporter',
  remote_rds: 'Remote Amazon RDS',
  remote: 'Remote',
};

export const GET_SERVICES_CANCEL_TOKEN = 'getServices';
export const GET_NODES_CANCEL_TOKEN = 'getNodes';
export const GET_AGENTS_CANCEL_TOKEN = 'getAgents';
