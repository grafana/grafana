import { SelectInstance } from '../../panel.types';

export interface DiscoverySearchPanelProps {
  selectInstance: SelectInstance;
}

export interface Instance {
  region: string;
  az: string;
  instance_id: string;
  node_model: string;
  address: string;
  port: number;
  type: string;
  engine_version: string;
  isAzure?: boolean;
}

export interface AzureDatabaseInstances {
  azure_database_instance: Instance[];
}
