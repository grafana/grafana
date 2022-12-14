import { Databases } from 'app/percona/shared/core';

import { Operators } from '../EditDBClusterPage/DBClusterBasicOptions/DBClusterBasicOptions.types';
import {
  CpuUnits,
  DBCluster,
  DBClusterConnection,
  DBClusterStatus,
  ResourcesUnits,
  DBClusterComponentVersionStatus,
  DBClusterAllocatedResources,
  ResourcesWithUnits,
} from '../DBCluster.types';

export const dbClustersStub: DBCluster[] = [
  {
    kubernetesClusterName: 'Kubernetes Cluster 1',
    clusterName: 'dbcluster1',
    databaseType: Databases.mysql,
    clusterSize: 3,
    memory: 1024,
    cpu: 1,
    disk: 25,
    status: DBClusterStatus.ready,
    finishedSteps: 5,
    totalSteps: 10,
    expose: true,
    installedImage: 'percona/percona-xtra-dbcluster:5.6',
    availableImage: 'percona/percona-xtra-dbcluster:8.0',
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 2',
    clusterName: 'dbcluster2',
    databaseType: Databases.mysql,
    clusterSize: 7,
    memory: 2048,
    cpu: 4,
    disk: 25,
    finishedSteps: 7,
    totalSteps: 7,
    expose: false,
    installedImage: 'percona/percona-xtra-dbcluster:8.0',
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 1',
    clusterName: 'mongodbcluster1',
    databaseType: Databases.mongodb,
    clusterSize: 3,
    memory: 0,
    cpu: 0,
    disk: 25,
    status: DBClusterStatus.ready,
    finishedSteps: 1,
    totalSteps: 2,
    expose: false,
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 2',
    clusterName: 'dbcluster3',
    databaseType: Databases.mysql,
    clusterSize: 7,
    memory: 2048,
    cpu: 4,
    disk: 25,
    status: DBClusterStatus.failed,
    message: 'Cluster creation failed',
    finishedSteps: 0,
    totalSteps: 2,
    expose: false,
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 1',
    clusterName: 'dbcluster4',
    databaseType: Databases.mysql,
    clusterSize: 3,
    memory: 1024,
    cpu: 1,
    disk: 25,
    status: DBClusterStatus.failed,
    finishedSteps: 5,
    totalSteps: 10,
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 1',
    clusterName: 'dbcluster5',
    databaseType: Databases.mysql,
    clusterSize: 3,
    memory: 1024,
    cpu: 1,
    disk: 25,
    status: DBClusterStatus.suspended,
    finishedSteps: 5,
    totalSteps: 10,
  },
];

export const xtraDBClusterConnectionStub: DBClusterConnection = {
  host: 'dbcluster-haproxy',
  password: '1234',
  port: 3000,
  username: 'root',
};

export const mongoDBClusterConnectionStub: DBClusterConnection = {
  host: 'dbcluster-psmdb',
  password: '1234',
  port: 3000,
  username: 'root',
};

export const getDBClustersActionStub = jest.fn();

export const dbClusterLogsAPI = {
  logs: [
    {
      pod: 'testpod1',
      container: 'testpod1container1',
      logs: ['test pod1', 'logs', '1'],
    },
    {
      pod: 'testpod1',
      container: 'testpod1container2',
      logs: ['test pod1', 'logs', '2'],
    },
    {
      pod: 'testpod1',
      logs: ['test pod1', 'events'],
    },
    {
      pod: 'testpod2',
      container: 'testpod2container1',
      logs: ['test pod2', 'logs', '1'],
    },
    {
      pod: 'testpod2',
      logs: ['test pod2', 'events'],
    },
    {
      pod: 'testpod2',
      container: 'testpod2container2',
      logs: [],
    },
  ],
};

export const dbCLusterAllocatedResourcesStub: DBClusterAllocatedResources = {
  total: {
    cpu: { value: 10, units: CpuUnits.MILLI, original: 10 },
    memory: { value: 10, units: ResourcesUnits.GB, original: 10 },
    disk: { value: 100, units: ResourcesUnits.GB, original: 100 },
  },
  allocated: {
    cpu: { value: 1, units: CpuUnits.MILLI, original: 1 },
    memory: { value: 3, units: ResourcesUnits.GB, original: 3 },
    disk: { value: 10, units: ResourcesUnits.GB, original: 10 },
  },
};

export const dbClusterExpectedResourcesStub = {
  expected: {
    memory: { value: 4, units: ResourcesUnits.GB },
    cpu: { value: 4, units: CpuUnits.MILLI },
    disk: { value: 20, units: ResourcesUnits.GB },
  },
};

export const versionsStub = {
  '1.0': {
    image_path: 'test_image',
    image_hash: 'test_hash',
    status: DBClusterComponentVersionStatus.available,
    critical: false,
    default: false,
  },
  '2.0': {
    image_path: 'test_image',
    image_hash: 'test_hash',
    status: DBClusterComponentVersionStatus.recommended,
    critical: false,
    default: true,
  },
};

export const xtradbComponentsVersionsStubs = {
  versions: [
    {
      product: Operators.pxc,
      operator: '1',
      matrix: {
        pxc: versionsStub,
        haproxy: versionsStub,
      },
    },
  ],
};

export const psmdbComponentsVersionsStubs = {
  versions: [
    {
      product: Operators.psmdb,
      operator: '1',
      matrix: {
        mongod: versionsStub,
      },
    },
  ],
};

export const resourcesA: ResourcesWithUnits = {
  value: 10,
  original: 10,
  units: ResourcesUnits.BYTES,
};

export const resourcesB: ResourcesWithUnits = {
  value: 20,
  original: 20,
  units: ResourcesUnits.BYTES,
};

export const resourcesC: ResourcesWithUnits = {
  value: 20,
  original: 20,
  units: ResourcesUnits.GB,
};
