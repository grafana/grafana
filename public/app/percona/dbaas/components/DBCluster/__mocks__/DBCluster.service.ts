import { DBClusterAllocatedResources } from '../DBCluster.types';

import { dbCLusterAllocatedResourcesStub, dbClusterLogsAPI, dbClusterTemplatesApi } from './dbClustersStubs';

export class DBClusterService {
  static async getLogs() {
    return dbClusterLogsAPI;
  }

  static async getAllocatedResources(): Promise<DBClusterAllocatedResources> {
    return Promise.resolve(dbCLusterAllocatedResourcesStub);
  }
  static async getDBClusters() {
    return Promise.resolve();
  }

  static getDBClusterTemplates() {
    return Promise.resolve(dbClusterTemplatesApi);
  }
}
