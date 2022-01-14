import { xtraDBClusterConnectionStub } from './dbClustersStubs';

export class XtraDBService {
  getDBClusterCredentials() {
    return { connection_credentials: xtraDBClusterConnectionStub };
  }

  restartDBCluster() {}
}
