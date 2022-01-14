import { RemoteInstanceCredentials } from 'app/percona/add-instance/panel.types';

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

interface Instance {
  type: any;
  credentials?: any;
}

export interface AddRemoteInstanceProps {
  instance: Instance;
  selectInstance: (intance: any) => void;
}

export interface AddNode {
  node_name: string;
  node_type: string;
}

export enum DefaultPorts {
  small = 'small',
  medium = 'medium',
  large = 'large',
  custom = 'custom',
}

export interface RemoteInstanceExternalservicePayload {
  custom_labels: {};
  service_name: string;
  address?: string;
  add_node: AddNode;
  listen_port: string;
  metrics_mode: number;
}

export interface RemoteInstancePayload {
  custom_labels: {};
  service_name: string;
  address?: string;
  listen_port: string;
  metrics_mode: number;
  node_name?: string;
  qan?: string;
}
