export interface DiscoverySearchPanelProps {
  selectInstance: (instanceData: any) => void;
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
  rds_instances: Instance;
}
