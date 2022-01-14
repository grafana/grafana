import { DBCluster } from '../DBCluster.types';

export interface DBClusterNameProps {
  dbCluster: DBCluster;
}

export interface DashboardURLMap {
  [key: string]: (clusterName: string) => string;
}
