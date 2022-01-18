import { omit, pick } from 'lodash';
import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';
import { Kubernetes } from '../Kubernetes/Kubernetes.types';
import {
  DatabaseVersion,
  CpuUnits,
  DBCluster,
  DBClusterActionAPI,
  DBClusterComponents,
  DBClusterConnectionAPI,
  DBClusterExpectedResources,
  DBClusterExpectedResourcesAPI,
  DBClusterPayload,
  DBClusterStatus,
  ResourcesUnits,
  DBClusterComponent,
  DBClusterChangeComponentsAPI,
} from './DBCluster.types';
import { DBClusterService } from './DBCluster.service';
import { getClusterStatus } from './DBCluster.utils';
import { BILLION, THOUSAND } from './DBCluster.constants';
import {
  ManageComponentsVersionsRenderProps,
  SupportedComponents,
} from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.types';
import { getComponentChange } from './DBCluster.service.utils';
import { Operators } from './AddDBClusterModal/DBClusterBasicOptions/DBClusterBasicOptions.types';

export const DBCLUSTER_STATUS_MAP = {
  [DBClusterStatus.invalid]: 'PSMDB_CLUSTER_STATE_INVALID',
  [DBClusterStatus.changing]: 'PSMDB_CLUSTER_STATE_CHANGING',
  [DBClusterStatus.ready]: 'PSMDB_CLUSTER_STATE_READY',
  [DBClusterStatus.failed]: 'PSMDB_CLUSTER_STATE_FAILED',
  [DBClusterStatus.deleting]: 'PSMDB_CLUSTER_STATE_DELETING',
  [DBClusterStatus.suspended]: 'PSMDB_CLUSTER_STATE_PAUSED',
  [DBClusterStatus.upgrading]: 'PSMDB_CLUSTER_STATE_UPGRADING',
  [DBClusterStatus.unknown]: 'PSMDB_CLUSTER_STATE_UNKNOWN',
};

export class PSMDBService extends DBClusterService {
  getDBClusters(kubernetes: Kubernetes): Promise<DBClusterPayload> {
    return apiManagement.post<any, Kubernetes>('/DBaaS/PSMDBClusters/List', kubernetes, true);
  }

  addDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PSMDBCluster/Create', toAPI(dbCluster));
  }

  updateDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PSMDBCluster/Update', toAPI(dbCluster));
  }

  resumeDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PSMDBCluster/Update', toResumeAPI(dbCluster));
  }

  suspendDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PSMDBCluster/Update', toSuspendAPI(dbCluster));
  }

  deleteDBClusters(dbCluster: DBCluster): Promise<void> {
    const toAPI = (cluster: DBCluster): DBClusterActionAPI => ({
      name: cluster.clusterName,
      kubernetes_cluster_name: dbCluster.kubernetesClusterName,
    });

    return apiManagement.post<any, DBClusterActionAPI>('/DBaaS/PSMDBCluster/Delete', toAPI(dbCluster));
  }

  getDBClusterCredentials(dbCluster: DBCluster): Promise<void | DBClusterConnectionAPI> {
    return apiManagement.post<DBClusterConnectionAPI, any>(
      '/DBaaS/PSMDBClusters/GetCredentials',
      omit(toAPI(dbCluster), ['params'])
    );
  }

  restartDBCluster(dbCluster: DBCluster): Promise<void> {
    return apiManagement.post<any, DBClusterActionAPI>(
      '/DBaaS/PSMDBCluster/Restart',
      omit(toAPI(dbCluster), ['params'])
    );
  }

  getComponents(kubernetesClusterName: string): Promise<DBClusterComponents> {
    return apiManagement.post<DBClusterComponents, any>('/DBaaS/Components/GetPSMDB', {
      kubernetes_cluster_name: kubernetesClusterName,
    });
  }

  setComponents(kubernetesClusterName: string, componentsVersions: ManageComponentsVersionsRenderProps): Promise<void> {
    return apiManagement.post<any, DBClusterChangeComponentsAPI>('/DBaaS/Components/ChangePSMDB', {
      kubernetes_cluster_name: kubernetesClusterName,
      mongod: getComponentChange(Operators.psmdb, SupportedComponents.mongod, componentsVersions),
    });
  }

  getDatabaseVersions(kubernetesClusterName: string): Promise<DatabaseVersion[]> {
    return this.getComponents(kubernetesClusterName).then(({ versions }) => {
      return Object.entries(versions[0].matrix.mongod as DBClusterComponent).map(([version, component]) => ({
        value: component.image_path,
        label: version,
        default: !!component.default,
        disabled: !!component.disabled,
      }));
    });
  }

  getExpectedResources(dbCluster: DBCluster): Promise<DBClusterExpectedResources> {
    return apiManagement
      .post<any, Partial<DBClusterPayload>>('/DBaaS/PSMDBCluster/Resources/Get', pick(toAPI(dbCluster), ['params']))
      .then(({ expected }: DBClusterExpectedResourcesAPI) => ({
        expected: {
          cpu: { value: expected.cpu_m / THOUSAND, units: CpuUnits.MILLI, original: +expected.cpu_m },
          memory: {
            value: expected.memory_bytes / BILLION,
            units: ResourcesUnits.GB,
            original: +expected.memory_bytes,
          },
          disk: { value: expected.disk_size / BILLION, units: ResourcesUnits.GB, original: +expected.disk_size },
        },
      }));
  }

  toModel(dbCluster: DBClusterPayload, kubernetesClusterName: string, databaseType: Databases): DBCluster {
    return {
      clusterName: dbCluster.name,
      kubernetesClusterName,
      databaseType,
      clusterSize: dbCluster.params.cluster_size,
      memory: (dbCluster.params.replicaset?.compute_resources?.memory_bytes || 0) / BILLION,
      cpu: (dbCluster.params.replicaset?.compute_resources?.cpu_m || 0) / THOUSAND,
      disk: (dbCluster.params.replicaset?.disk_size || 0) / BILLION,
      status: getClusterStatus(dbCluster.state, DBCLUSTER_STATUS_MAP),
      message: dbCluster.operation?.message,
      finishedSteps: dbCluster.operation?.finished_steps || 0,
      totalSteps: dbCluster.operation?.total_steps || 0,
      expose: dbCluster.exposed,
      installedImage: dbCluster.installed_image,
      availableImage: dbCluster.available_image,
    };
  }
}

const toAPI = (dbCluster: DBCluster) => ({
  kubernetes_cluster_name: dbCluster.kubernetesClusterName,
  name: dbCluster.clusterName,
  expose: dbCluster.expose,
  params: {
    cluster_size: dbCluster.clusterSize,
    replicaset: {
      compute_resources: {
        cpu_m: dbCluster.cpu * THOUSAND,
        memory_bytes: dbCluster.memory * BILLION,
      },
      disk_size: dbCluster.disk * BILLION,
    },
    image: dbCluster.databaseImage,
  },
});

const toSuspendAPI = (dbCluster: DBCluster) => ({
  kubernetes_cluster_name: dbCluster.kubernetesClusterName,
  name: dbCluster.clusterName,
  params: {
    suspend: true,
  },
});

const toResumeAPI = (dbCluster: DBCluster) => ({
  kubernetes_cluster_name: dbCluster.kubernetesClusterName,
  name: dbCluster.clusterName,
  params: {
    resume: true,
  },
});
