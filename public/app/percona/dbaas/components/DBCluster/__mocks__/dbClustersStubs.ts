import { Databases } from 'app/percona/shared/core';
import { CpuUnits, DBCluster, DBClusterConnection, DBClusterStatus, ResourcesUnits } from '../DBCluster.types';

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
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 2',
    clusterName: 'dbcluster2',
    databaseType: Databases.mysql,
    clusterSize: 7,
    memory: 2048,
    cpu: 4,
    disk: 25,
    status: DBClusterStatus.failed,
    message: 'Cluster creation failed',
    finishedSteps: 0,
    totalSteps: 2,
  },
  {
    kubernetesClusterName: 'Kubernetes Cluster 1',
    clusterName: 'dbcluster1',
    databaseType: Databases.mysql,
    clusterSize: 3,
    memory: 1024,
    cpu: 1,
    disk: 25,
    status: DBClusterStatus.failed,
    finishedSteps: 5,
    totalSteps: 10,
  },
];

export const xtraDBClusterConnectionStub: DBClusterConnection = {
  host: 'dbcluster-proxysql',
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

export const dbCLusterAllocatedResourcesStub = {
  total: {
    cpu: { value: 10, units: CpuUnits.MILLI },
    memory: { value: 10, units: ResourcesUnits.GB },
    disk: { value: 100, units: ResourcesUnits.GB },
  },
  allocated: {
    cpu: { value: 1, units: CpuUnits.MILLI },
    memory: { value: 3, units: ResourcesUnits.GB },
    disk: { value: 10, units: ResourcesUnits.GB },
  },
};

export const dbClusterExpectedResourcesStub = {
  expected: {
    memory: { value: 4, units: ResourcesUnits.GB },
    cpu: { value: 4, units: CpuUnits.MILLI },
    disk: { value: 20, units: ResourcesUnits.GB },
  },
};
