import { dbClusterLogsAPI } from './dbClustersStubs';

export class DBClusterService {
  static async getLogs() {
    return dbClusterLogsAPI;
  }
}
