import { Kubernetes } from 'app/percona/dbaas/components/Kubernetes/Kubernetes.types';

import { DBCluster, ManageDBClusters } from '../DBCluster.types';

import { dbClustersStub, getDBClustersActionStub } from './dbClustersStubs';

export const useDBClusters = (kubernetes: Kubernetes[]): ManageDBClusters => {
  const dbClusters: DBCluster[] = [];

  if (kubernetes.length > 0) {
    dbClusters.push(...dbClustersStub);
  }

  return [dbClusters, getDBClustersActionStub, () => {}, false];
};
