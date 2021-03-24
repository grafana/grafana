import { DBClusterExpectedResources } from '../DBCluster.types';
import { dbClusterExpectedResourcesStub, mongoDBClusterConnectionStub } from './dbClustersStubs';

export class PSMDBService {
  getDBClusterCredentials() {
    return { connection_credentials: mongoDBClusterConnectionStub };
  }

  restartDBCluster() {}

  getExpectedResources(): Promise<DBClusterExpectedResources> {
    return Promise.resolve(dbClusterExpectedResourcesStub);
  }
}
