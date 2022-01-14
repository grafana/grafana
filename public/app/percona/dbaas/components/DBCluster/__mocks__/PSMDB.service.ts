import { mongoDBClusterConnectionStub } from './dbClustersStubs';

export class PSMDBService {
  getDBClusterCredentials() {
    return { connection_credentials: mongoDBClusterConnectionStub };
  }

  restartDBCluster() {}
}
