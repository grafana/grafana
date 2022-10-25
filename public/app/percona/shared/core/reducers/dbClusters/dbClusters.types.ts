import { DBCluster, DBClusterPayload } from '../../../../dbaas/components/DBCluster/DBCluster.types';

export interface PerconaDBClustersState {
  result: DBCluster[];
  loading: boolean | undefined;
  credentialsLoading: boolean | undefined;
}

export interface DBClusterListApi {
  pxc_clusters?: DBClusterPayload[];
  psmdb_clusters?: DBClusterPayload[];
}
