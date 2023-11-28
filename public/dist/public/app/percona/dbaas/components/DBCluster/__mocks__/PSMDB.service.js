import { dbClusterExpectedResourcesStub, mongoDBClusterConnectionStub, psmdbComponentsVersionsStubs, } from './dbClustersStubs';
export class PSMDBService {
    getDBClusterCredentials() {
        return { connection_credentials: mongoDBClusterConnectionStub };
    }
    restartDBCluster() { }
    getExpectedResources() {
        return Promise.resolve(dbClusterExpectedResourcesStub);
    }
    getComponents() {
        return Promise.resolve(psmdbComponentsVersionsStubs);
    }
    updateDBCluster() {
        return Promise.resolve();
    }
}
//# sourceMappingURL=PSMDB.service.js.map