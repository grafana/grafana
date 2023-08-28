import { RemoteInstanceCredentials, InstanceAvailable, SelectInstance } from 'app/percona/add-instance/panel.types';

export interface FormValues extends RemoteInstanceCredentials {
  qan_mysql_perfschema?: boolean;
  disable_comments_parsing?: boolean;
  tracking?: 'qan_postgresql_pgstatements_agent';
}

export enum TrackingOptions {
  none = 'none',
  pgStatements = 'qan_postgresql_pgstatements_agent',
  pgMonitor = 'qan_postgresql_pgstatmonitor_agent',
}

export interface InstanceData {
  instanceType?: string;
  defaultPort?: number;
  remoteInstanceCredentials: RemoteInstanceCredentials;
  discoverName?: string;
}

export interface AddRemoteInstanceProps {
  instance: InstanceAvailable;
  selectInstance: SelectInstance;
  onSubmit: (submitPromise: Promise<void>) => void;
}

export enum DefaultPorts {
  small = 'small',
  medium = 'medium',
  large = 'large',
  custom = 'custom',
}

// export interface RemoteInstancePayload {
//   custom_labels: {};
//   service_name: string;
//   address?: string;
//   listen_port: string;
//   metrics_mode: number;
//   node_name?: string;
//   qan?: string;
// }

interface AddNode {
  node_name: string;
  node_type: string;
  machine_id: string;
  distro: string;
  container_id: string;
  container_name: string;
  node_model: string;
  region: string;
  az: string;
  custom_labels: {};
}

interface RemoteCommonPayload {
  node_name?: string;
  address?: string;
  service_name?: string;
  username?: string;
  password?: string;
  environment?: string;
  custom_labels?: Record<string, string>;
  skip_connection_check?: boolean;
}
interface TLSCommon {
  tls?: boolean;
  tls_skip_verify?: boolean;
}

export interface ProxySQLPayload extends RemoteCommonPayload, TLSCommon {
  node_id: string;
  add_node: AddNode;
  port: number;
  socket: string;
  pmm_agent_id: string;
  cluster: string;
  replication_set: string;
  metrics_mode: string;
  disable_collectors: string[];
  agent_password: string;
}

export interface PostgreSQLPayload extends RemoteCommonPayload, TLSCommon {
  node_id: string;
  add_node: AddNode;
  port: number;
  socket: string;
  pmm_agent_id: string;
  cluster: string;
  replication_set: string;
  qan_postgresql_pgstatements_agent: boolean;
  qan_postgresql_pgstatmonitor_agent: boolean;
  disable_query_examples: boolean;
  disable_comments_parsing: boolean;
  metrics_mode: string;
  disable_collectors: string[];
  tls_ca: string;
  tls_cert: string;
  tls_key: string;
  agent_password: string;
  max_query_length: number;
}

export interface MySQLPayload extends RemoteCommonPayload, TLSCommon {
  node_id: string;
  add_node: AddNode;
  port: number;
  socket: string;
  pmm_agent_id: string;
  cluster: string;
  replication_set: string;
  qan_mysql_perfschema: boolean;
  disable_comments_parsing: boolean;
  qan_mysql_slowlog: boolean;
  disable_query_examples: boolean;
  max_slowlog_file_size: string;
  tablestats_group_table_limit: number;
  metrics_mode: string;
  disable_collectors: string[];
  agent_password: string;
  tls_cert: string;
  tls_key: string;
  tls_ca: string;
  max_query_length: number;
}

export interface MongoDBPayload extends RemoteCommonPayload, TLSCommon {
  node_id: string;
  add_node: AddNode;
  port: number;
  socket: string;
  pmm_agent_id: string;
  cluster: string;
  replication_set: string;
  qan_mongodb_profiler: boolean;
  tls_certificate_key: string;
  tls_certificate_key_file_password: string;
  tls_ca: string;
  metrics_mode: string;
  disable_collectors: string[];
  authentication_mechanism: string;
  authentication_database: string;
  agent_password: string;
  max_query_length: number;
}

export interface HaProxyPayload extends RemoteCommonPayload {
  node_id: string;
  add_node: AddNode;
  scheme: string;
  metrics_path: string;
  listen_port: number;
  cluster: string;
  replication_set: string;
  metrics_mode: string;
}

export interface ExternalPayload extends RemoteCommonPayload {
  runs_on_node_id: string;
  add_node: AddNode;
  scheme: string;
  metrics_path: string;
  listen_port: number;
  node_id: string;
  cluster: string;
  replication_set: string;
  group: string;
  metrics_mode: string;
}

export interface CommonRDSAzurePayload extends RemoteCommonPayload, TLSCommon {
  region?: string;
  az?: string;
  instance_id?: string;
  node_model?: string;
  port?: string;
  tablestats_group_table_limit?: number;
  disable_query_examples?: boolean;
}

export interface RDSPayload extends CommonRDSAzurePayload {
  engine: string;
  cluster: string;
  replication_set: string;
  aws_access_key: string;
  aws_secret_key: string;
  rds_exporter: boolean;
  qan_mysql_perfschema: boolean;
  disable_parsing_comments: boolean;
  disable_basic_metrics: boolean;
  disable_enhanced_metrics: boolean;
  metrics_mode: string;
  qan_postgresql_pgstatements: boolean;
  agent_password: string;
}

export interface MSAzurePayload extends CommonRDSAzurePayload {
  azure_client_id?: string;
  azure_client_secret?: string;
  azure_tenant_id?: string;
  azure_subscription_id?: string;
  azure_resource_group?: string;
  azure_database_exporter?: boolean;
  qan?: boolean;
  type?: string;
}

export type RemoteInstancePayload =
  | MSAzurePayload
  | RDSPayload
  | MySQLPayload
  | HaProxyPayload
  | ProxySQLPayload
  | PostgreSQLPayload
  | MongoDBPayload
  | ExternalPayload;

export interface ErrorResponse {
  error: string;
  code: number;
  message: string;
  details: [
    {
      type_url: string;
      value: string;
    }
  ];
}

interface Service {
  service_id: string;
  service_name: string;
  node_id: string;
  socket: string;
  environment: string;
  cluster: string;
  replication_set: string;
  custom_labels: {};
}

interface ExtendedService extends Service {
  address: string;
  port: number;
}
interface BaseExporter {
  agent_id: string;
  pmm_agent_id: string;
  disabled: boolean;
  service_id: string;
  username: string;
  tls: boolean;
  tls_skip_verify: boolean;
  custom_labels: {};
  status: string;
}

interface Node {
  node_id: string;
  node_name: string;
  address: string;
  node_model: string;
  region: string;
  az: string;
  custom_labels: {};
}

interface MySQLExporter extends BaseExporter {
  tls_ca: string;
  tls_cert: string;
  tls_key: string;
  tablestats_group_table_limit: number;
  push_metrics_enabled: boolean;
  tablestats_group_disabled: boolean;
  disabled_collectors: string[];
  listen_port: number;
}

interface MySQLPerfschema extends BaseExporter {
  tls_ca: string;
  tls_cert: string;
  tls_key: string;
  query_examples_disabled: boolean;
}

interface MySQLShowLog extends MySQLPerfschema {
  max_slowlog_file_size: string;
}

interface PostgreSQLExporter extends BaseExporter {
  push_metrics_enabled: boolean;
  disabled_collectors: string[];
  listen_port: number;
}

interface PgStatMonitorAgent extends BaseExporter {
  query_examples_disabled: boolean;
}

interface ProxySQLExporter extends BaseExporter {
  push_metrics_enabled: boolean;
  disabled_collectors: string[];
  listen_port: number;
}

interface MongoDbExporter extends BaseExporter {
  push_metrics_enabled: boolean;
  disabled_collectors: string[];
  listen_port: number;
}

export interface MySQLInstanceResponse {
  service: ExtendedService;
  mysqld_exporter: MySQLExporter;
  qan_mysql_perfschema: MySQLPerfschema;
  qan_mysql_slowlog: MySQLShowLog;
  table_count: number;
}

export interface PostgreSQLInstanceResponse {
  service: ExtendedService;
  postgres_exporter: PostgreSQLExporter;
  qan_postgresql_pgstatements_agent: BaseExporter;
  qan_postgresql_pgstatmonitor_agent: PgStatMonitorAgent;
}

export interface ProxySQLInstanceResponse {
  service: ExtendedService;
  proxysql_exxporter: ProxySQLExporter;
}

export interface AddHaProxyResponse {
  service: Service;
  external_exporter: {
    agent_id: string;
    runs_on_node_id: string;
    disabled: true;
    service_id: string;
    username: string;
    scheme: string;
    metrics_path: string;
    custom_labels: {};
    listen_port: number;
    push_metrics_enabled: true;
  };
}

export interface AddMongoDbResponse {
  service: ExtendedService;
  mongodb_exporter: MongoDbExporter;
  qan_mongodb_profiler: BaseExporter;
}

export interface AddRDSResponse {
  node: Node;
  rds_exporter: {
    agent_id: string;
    pmm_agent_id: string;
    disabled: boolean;
    node_id: string;
    aws_access_key: string;
    custom_labels: {};
    status: string;
    listen_port: number;
    basic_metrics_disabled: boolean;
    enhanced_metrics_disabled: boolean;
    push_metrics_enabled: boolean;
  };
  mysql: {
    service_id: string;
    service_name: string;
    node_id: string;
    address: string;
    port: number;
    socket: string;
    environment: string;
    cluster: string;
    replication_set: string;
    custom_labels: {};
  };
  mysqld_exporter: MySQLExporter;
  qan_mysql_perfschema: MySQLPerfschema;
  table_count: number;
  postgresql: {
    service_id: string;
    service_name: string;
    node_id: string;
    address: string;
    port: number;
    socket: string;
    environment: string;
    cluster: string;
    replication_set: string;
    custom_labels: {};
  };
  postgresql_exporter: PostgreSQLExporter;
  qan_postgresql_pgstatements: BaseExporter;
}

export interface AddExternalResponse {
  service: {
    service_id: string;
    service_name: string;
    node_id: string;
    environment: string;
    cluster: string;
    replication_set: string;
    custom_labels: {};
    group: string;
  };
  external_exporter: {
    agent_id: string;
    runs_on_node_id: string;
    disabled: boolean;
    service_id: string;
    username: string;
    scheme: string;
    metrics_path: string;
    custom_labels: {};
    listen_port: number;
    push_metrics_enabled: boolean;
  };
}
