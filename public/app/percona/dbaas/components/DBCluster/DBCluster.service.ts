import { CancelToken } from 'axios';

import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';

import { Kubernetes } from '../Kubernetes/Kubernetes.types';
import { ManageComponentsVersionsRenderProps } from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.types';

import { BILLION, RESOURCES_PRECISION, THOUSAND } from './DBCluster.constants';
import {
  DBCluster,
  DBClusterPayload,
  DBClusterConnectionAPI,
  DBClusterLogsAPI,
  DBClusterAllocatedResources,
  DBClusterAllocatedResourcesAPI,
  DatabaseVersion,
  DBClusterComponents,
  DBClusterExpectedResources,
  ResourcesUnits,
  CpuUnits,
  DBClusterListResponse,
  DBClusterSecretsResponse,
  DBClusterSecretsRequest,
  DBClusterTemplatesResponse,
  DBClusterTemplatesRequest,
  DBClusterType,
  DBClusterResponse,
} from './DBCluster.types';
import { formatResources } from './DBCluster.utils';

export abstract class DBClusterService {
  abstract addDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract updateDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract suspendDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract resumeDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload>;

  abstract deleteDBClusters(dbCluster: DBCluster): Promise<void>;

  abstract getDBClusterCredentials(dbCluster: DBCluster): Promise<void | DBClusterConnectionAPI>;

  abstract restartDBCluster(dbCluster: DBCluster): Promise<void>;

  abstract getComponents(kubernetesClusterName: string): Promise<DBClusterComponents>;

  abstract setComponents(
    kubernetesClusterName: string,
    componentsVersions: ManageComponentsVersionsRenderProps
  ): Promise<void>;

  abstract getDatabaseVersions(kubernetesClusterName: string): Promise<DatabaseVersion[]>;

  abstract getExpectedResources(dbCluster: DBCluster): Promise<DBClusterExpectedResources>;

  abstract getClusterConfiguration(dbCluster: DBCluster): Promise<DBClusterPayload>;

  abstract toModel(dbCluster: DBClusterResponse, kubernetesClusterName: string, databaseType: Databases): DBCluster;

  static async getDBClusters(kubernetes: Kubernetes, token?: CancelToken): Promise<DBClusterListResponse> {
    return apiManagement.post<DBClusterListResponse, Kubernetes>('/DBaaS/DBClusters/List', kubernetes, true, token);
  }

  static async getLogs({ kubernetesClusterName, clusterName }: DBCluster): Promise<DBClusterLogsAPI> {
    return apiManagement.post<DBClusterLogsAPI, object>(
      '/DBaaS/GetLogs',
      {
        kubernetes_cluster_name: kubernetesClusterName,
        cluster_name: clusterName,
      },
      true
    );
  }

  static async getDBClusterSecrets(kubernetesClusterName: string): Promise<DBClusterSecretsResponse> {
    return apiManagement.post<DBClusterSecretsResponse, DBClusterSecretsRequest>(
      '/DBaaS/Secrets/List',
      {
        kubernetes_cluster_name: kubernetesClusterName,
      },
      true
    );
  }

  static async getAllocatedResources(kubernetesClusterName: string): Promise<DBClusterAllocatedResources> {
    return apiManagement
      .post<DBClusterAllocatedResourcesAPI, object>('/DBaaS/Kubernetes/Resources/Get', {
        kubernetes_cluster_name: kubernetesClusterName,
      })
      .then(({ all, available }) => {
        const allocatedCpu = all.cpu_m - available.cpu_m;
        const allocatedMemory = all.memory_bytes - available.memory_bytes;
        const allocatedDisk = all.disk_size - available.disk_size;

        return {
          total: {
            cpu: { value: all.cpu_m / THOUSAND, units: CpuUnits.MILLI, original: +all.cpu_m },
            memory: { value: all.memory_bytes / BILLION, units: ResourcesUnits.GB, original: +all.memory_bytes },
            disk: formatResources(+all.disk_size, RESOURCES_PRECISION),
          },
          allocated: {
            cpu: { value: allocatedCpu / THOUSAND, units: CpuUnits.MILLI, original: allocatedCpu },
            memory: {
              value: allocatedMemory / BILLION,
              units: ResourcesUnits.GB,
              original: allocatedMemory,
            },
            disk: { value: allocatedDisk / BILLION, units: ResourcesUnits.GB, original: allocatedDisk },
          },
        };
      });
  }
  static async getDBClusterTemplates(
    kubernetesClusterName: string,
    k8sClusterType: DBClusterType
  ): Promise<DBClusterTemplatesResponse> {
    return apiManagement.post<DBClusterTemplatesResponse, DBClusterTemplatesRequest>(
      '/DBaaS/Templates/List',
      { kubernetes_cluster_name: kubernetesClusterName, cluster_type: k8sClusterType },
      true
    );
  }
}
