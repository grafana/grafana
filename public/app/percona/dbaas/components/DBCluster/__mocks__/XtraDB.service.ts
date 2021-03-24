import { DBClusterExpectedResources } from '../DBCluster.types';
import { dbClusterExpectedResourcesStub, xtraDBClusterConnectionStub } from './dbClustersStubs';

export class XtraDBService {
  getDBClusterCredentials() {
    return { connection_credentials: xtraDBClusterConnectionStub };
  }

  restartDBCluster() {}

  getExpectedResources(): Promise<DBClusterExpectedResources> {
    return Promise.resolve(dbClusterExpectedResourcesStub);
  }
}
