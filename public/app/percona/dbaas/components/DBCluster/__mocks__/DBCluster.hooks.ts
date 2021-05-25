import { Kubernetes } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.types';
import { dbClustersStub, getDBClustersActionStub } from './dbClustersStubs';
import { DBCluster, ManageDBClusters } from '../DBCluster.types';

export const useDBClusters = (kubernetes: Kubernetes[]): ManageDBClusters => {
  const dbClusters: DBCluster[] = [];

  if (kubernetes.length > 0) {
    dbClusters.push(...dbClustersStub);
  }

  return [dbClusters, getDBClustersActionStub, () => {}, false];
};
