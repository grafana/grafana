import { DBCluster, DBClusterPayload } from '../../../../dbaas/components/DBCluster/DBCluster.types';

export interface PerconaDBClustersState {
  result: DBCluster[];
  loading?: boolean;
  credentialsLoading?: boolean;
}

export interface DBClusterListApi {
  pxc_clusters?: DBClusterPayload[];
  psmdb_clusters?: DBClusterPayload[];
}
