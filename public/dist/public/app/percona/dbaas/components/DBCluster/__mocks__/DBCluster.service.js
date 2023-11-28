import { __awaiter } from "tslib";
import { dbCLusterAllocatedResourcesStub, dbClusterLogsAPI, dbClusterTemplatesApi } from './dbClustersStubs';
export class DBClusterService {
    static getLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            return dbClusterLogsAPI;
        });
    }
    static getAllocatedResources() {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve(dbCLusterAllocatedResourcesStub);
        });
    }
    static getDBClusters() {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve();
        });
    }
    static getDBClusterTemplates() {
        return Promise.resolve(dbClusterTemplatesApi);
    }
}
//# sourceMappingURL=DBCluster.service.js.map