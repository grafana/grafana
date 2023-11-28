import { dbClustersStub, getDBClustersActionStub } from './dbClustersStubs';
export const useDBClusters = (kubernetes) => {
    const dbClusters = [];
    if (kubernetes.length > 0) {
        dbClusters.push(...dbClustersStub);
    }
    return [dbClusters, getDBClustersActionStub, () => { }, false];
};
//# sourceMappingURL=DBCluster.hooks.js.map