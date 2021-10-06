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
  [DBClusterStatus.invalid]: 'XTRA_DB_CLUSTER_STATE_INVALID',
  [DBClusterStatus.changing]: 'XTRA_DB_CLUSTER_STATE_CHANGING',
  [DBClusterStatus.ready]: 'XTRA_DB_CLUSTER_STATE_READY',
  [DBClusterStatus.failed]: 'XTRA_DB_CLUSTER_STATE_FAILED',
  [DBClusterStatus.deleting]: 'XTRA_DB_CLUSTER_STATE_DELETING',
  [DBClusterStatus.suspended]: 'XTRA_DB_CLUSTER_STATE_PAUSED',
  [DBClusterStatus.upgrading]: 'XTRA_DB_CLUSTER_STATE_UPGRADING',
  [DBClusterStatus.unknown]: 'XTRA_DB_CLUSTER_STATE_UNKNOWN',
};

export class XtraDBService extends DBClusterService {
  getDBClusters(kubernetes: Kubernetes): Promise<DBClusterPayload> {
    return apiManagement.post<any, Kubernetes>('/DBaaS/XtraDBClusters/List', kubernetes, true);
  }

  addDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/XtraDBCluster/Create', toAPI(dbCluster));
  }

  updateDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/XtraDBCluster/Update', toAPI(dbCluster));
  }

  resumeDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/XtraDBCluster/Update', toResumeAPI(dbCluster));
  }

  suspendDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/XtraDBCluster/Update', toSuspendAPI(dbCluster));
  }

  deleteDBClusters(dbCluster: DBCluster): Promise<void> {
    const toAPI = (cluster: DBCluster): DBClusterActionAPI => ({
      name: cluster.clusterName,
      kubernetes_cluster_name: dbCluster.kubernetesClusterName,
    });

    return apiManagement.post<any, DBClusterActionAPI>('/DBaaS/XtraDBCluster/Delete', toAPI(dbCluster));
  }

  getDBClusterCredentials(dbCluster: DBCluster): Promise<void | DBClusterConnectionAPI> {
    return apiManagement.post<DBClusterConnectionAPI, any>(
      '/DBaaS/XtraDBClusters/GetCredentials',
      omit(toAPI(dbCluster), ['params'])
    );
  }

  restartDBCluster(dbCluster: DBCluster): Promise<void> {
    return apiManagement.post<any, DBClusterActionAPI>(
      '/DBaaS/XtraDBCluster/Restart',
      omit(toAPI(dbCluster), ['params'])
    );
  }

  getComponents(kubernetesClusterName: string): Promise<DBClusterComponents> {
    return apiManagement.post<DBClusterComponents, any>('/DBaaS/Components/GetPXC', {
      kubernetes_cluster_name: kubernetesClusterName,
    });
  }

  setComponents(kubernetesClusterName: string, componentsVersions: ManageComponentsVersionsRenderProps): Promise<void> {
    return apiManagement.post<any, DBClusterChangeComponentsAPI>('/DBaaS/Components/ChangePXC', {
      kubernetes_cluster_name: kubernetesClusterName,
      pxc: getComponentChange(Operators.xtradb, SupportedComponents.pxc, componentsVersions),
      haproxy: getComponentChange(Operators.xtradb, SupportedComponents.haproxy, componentsVersions),
    });
  }

  getDatabaseVersions(kubernetesClusterName: string): Promise<DatabaseVersion[]> {
    return this.getComponents(kubernetesClusterName).then(({ versions }) => {
      return Object.entries(versions[0].matrix.pxc as DBClusterComponent).map(([version, component]) => ({
        value: component.image_path,
        label: version,
        default: !!component.default,
        disabled: !!component.disabled,
      }));
    });
  }

  getExpectedResources(dbCluster: DBCluster): Promise<DBClusterExpectedResources> {
    return apiManagement
      .post<any, Partial<DBClusterPayload>>('/DBaaS/XtraDBCluster/Resources/Get', pick(toAPI(dbCluster), ['params']))
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
      memory: (dbCluster.params.pxc?.compute_resources?.memory_bytes || 0) / BILLION,
      cpu: (dbCluster.params.pxc?.compute_resources?.cpu_m || 0) / THOUSAND,
      disk: (dbCluster.params.pxc?.disk_size || 0) / BILLION,
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

const toAPI = (dbCluster: DBCluster): DBClusterPayload => ({
  kubernetes_cluster_name: dbCluster.kubernetesClusterName,
  name: dbCluster.clusterName,
  expose: dbCluster.expose,
  params: {
    cluster_size: dbCluster.clusterSize,
    pxc: {
      compute_resources: {
        cpu_m: dbCluster.cpu * THOUSAND,
        memory_bytes: dbCluster.memory * BILLION,
      },
      disk_size: dbCluster.disk * BILLION,
      image: dbCluster.databaseImage,
    },
    // Temporary mock data
    haproxy: {
      compute_resources: {
        cpu_m: THOUSAND,
        memory_bytes: 2 * BILLION,
      },
    },
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
