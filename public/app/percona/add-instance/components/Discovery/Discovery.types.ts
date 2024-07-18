import { SelectInstance } from '../../panel.types';
export interface DiscoverySearchPanelProps {
  selectInstance: SelectInstance;
  onSubmit: (submitPromise: Promise<void>) => void;
}

export interface Instance {
  region: string;
  az: string;
  instance_id: string;
  node_model: string;
  address: string;
  port: number;
  engine: string;
  engine_version: string;
}
export interface RDSInstances {
  rds_instances: Instance[];
}

export enum DiscoverRDSEngine {
  POSTGRESQL = 'DISCOVER_RDS_ENGINE_POSTGRESQL',
  MYSQL = 'DISCOVER_RDS_ENGINE_MYSQL',
  UNSPECIFIED = 'DISCOVER_RDS_ENGINE_UNSPECIFIED',
}

export enum DiscoverAzureDatabaseType {
  POSTGRESQL = 'DISCOVER_AZURE_DATABASE_TYPE_POSTGRESQL',
  MYSQL = 'DISCOVER_AZURE_DATABASE_TYPE_MYSQL',
  MARIADB = 'DISCOVER_AZURE_DATABASE_TYPE_MARIADB',
  INVALID = 'DISCOVER_AZURE_DATABASE_INVALID',
}
