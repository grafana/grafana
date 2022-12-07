import { omit, pick } from 'lodash';

import { Databases } from 'app/percona/shared/core';
import { apiManagement } from 'app/percona/shared/helpers/api';

import {
  ManageComponentsVersionsRenderProps,
  SupportedComponents,
} from '../Kubernetes/ManageComponentsVersionsModal/ManageComponentsVersionsModal.types';

import { BILLION, THOUSAND } from './DBCluster.constants';
import { DBClusterService } from './DBCluster.service';
import { getComponentChange } from './DBCluster.service.utils';
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
  ResourcesUnits,
  DBClusterComponent,
  DBClusterChangeComponentsAPI,
  DBClusterType,
  DBClusterStatus,
  DBClusterSuspendResumeRequest,
} from './DBCluster.types';
import { Operators } from './EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';

export class XtraDBService extends DBClusterService {
  addDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PXCCluster/Create', toAPI(dbCluster));
  }

  updateDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<DBClusterPayload, any>('/DBaaS/PXCCluster/Update', toAPI(dbCluster));
  }

  resumeDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, DBClusterSuspendResumeRequest>(
      '/DBaaS/PXCCluster/Update',
      toResumeAPI(dbCluster)
    );
  }

  suspendDBCluster(dbCluster: DBCluster): Promise<void | DBClusterPayload> {
    return apiManagement.post<DBClusterPayload, DBClusterSuspendResumeRequest>(
      '/DBaaS/PXCCluster/Update',
      toSuspendAPI(dbCluster)
    );
  }

  deleteDBClusters(dbCluster: DBCluster): Promise<void> {
    const body = {
      name: dbCluster.clusterName,
      kubernetes_cluster_name: dbCluster.kubernetesClusterName,
      cluster_type: DBClusterType.pxc,
    };

    return apiManagement.post<void, DBClusterActionAPI>('/DBaaS/DBClusters/Delete', body);
  }

  getDBClusterCredentials(dbCluster: DBCluster): Promise<void | DBClusterConnectionAPI> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<DBClusterConnectionAPI, any>(
      '/DBaaS/PXCClusters/GetCredentials',
      omit(toAPI(dbCluster), ['params'])
    );
  }

  restartDBCluster(dbCluster: DBCluster): Promise<void> {
    const body = {
      name: dbCluster.clusterName,
      kubernetes_cluster_name: dbCluster.kubernetesClusterName,
      cluster_type: DBClusterType.pxc,
    };

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<any, DBClusterActionAPI>('/DBaaS/DBClusters/Restart', body);
  }

  getComponents(kubernetesClusterName: string): Promise<DBClusterComponents> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<DBClusterComponents, any>('/DBaaS/Components/GetPXC', {
      kubernetes_cluster_name: kubernetesClusterName,
    });
  }

  setComponents(kubernetesClusterName: string, componentsVersions: ManageComponentsVersionsRenderProps): Promise<void> {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    return apiManagement.post<any, DBClusterChangeComponentsAPI>('/DBaaS/Components/ChangePXC', {
      kubernetes_cluster_name: kubernetesClusterName,
      pxc: getComponentChange(Operators.pxc, SupportedComponents.pxc, componentsVersions),
      haproxy: getComponentChange(Operators.pxc, SupportedComponents.haproxy, componentsVersions),
    });
  }

  getDatabaseVersions(kubernetesClusterName: string): Promise<DatabaseVersion[]> {
    return this.getComponents(kubernetesClusterName).then(({ versions }) => {
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
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
      .post<DBClusterExpectedResourcesAPI, Partial<DBClusterPayload>>(
        '/DBaaS/PXCCluster/Resources/Get',
        pick(toAPI(dbCluster), ['params'])
      )
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
      status: dbCluster.state || DBClusterStatus.changing,
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
        cpu_m: THOUSAND / 2,
        memory_bytes: 0.5 * BILLION,
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
