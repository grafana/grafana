import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { Kubernetes } from '../Kubernetes/Kubernetes.types';
import { DBCluster, DBClusterPayload, DBClusterConnectionAPI, DBClusterLogsAPI } from './DBCluster.types';

export abstract class DBClusterService {
  abstract getDBClusters(kubernetes: Kubernetes): Promise<DBClusterPayload>;

  abstract addDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract updateDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract suspendDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract resumeDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract deleteDBClusters(dbCluster: DBCluster): Promise<void>;

  abstract getDBClusterCredentials(dbCluster: DBCluster): Promise<void | DBClusterConnectionAPI>;

  abstract restartDBCluster(dbCluster: DBCluster): Promise<void>;

  abstract toModel(dbCluster: DBClusterPayload, kubernetesClusterName: string, databaseType: Databases): DBCluster;

  static async getLogs({ kubernetesClusterName, clusterName }: DBCluster): Promise<DBClusterLogsAPI> {
    return apiManagement.post<DBClusterLogsAPI, any>(
      '/DBaaS/GetLogs',
      {
        kubernetes_cluster_name: kubernetesClusterName,
        cluster_name: clusterName,
      },
      true
    );
  }
}
