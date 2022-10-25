import { DBCluster, DBClusterPayload } from '../../../../dbaas/components/DBCluster/DBCluster.types';
import { newDBClusterService } from '../../../../dbaas/components/DBCluster/DBCluster.utils';
import { Kubernetes } from '../../../../dbaas/components/Kubernetes/Kubernetes.types';
import { Databases } from '../../types';

import { DBClusterListApi } from './dbClusters.types';

const clustersToModel = (database: Databases, clusters: DBClusterPayload[], kubernetes: Kubernetes[], index: number) =>
  clusters.map((cluster) => {
    return newDBClusterService(database).toModel(cluster, kubernetes[index].kubernetesClusterName, database);
  });

export const formatDBClusters = (results: DBClusterListApi[], kubernetes: Kubernetes[]) => {
  return results.reduce((acc: DBCluster[], r, index) => {
    const pxcClusters: DBClusterPayload[] = r.pxc_clusters ?? [];
    const psmdbClusters: DBClusterPayload[] = r.psmdb_clusters ?? [];
    const pxcClustersModel = clustersToModel(Databases.mysql, pxcClusters, kubernetes, index);
    const psmdbClustersModel = clustersToModel(Databases.mongodb, psmdbClusters, kubernetes, index);

    return acc.concat([...pxcClustersModel, ...psmdbClustersModel]);
  }, []);
};
