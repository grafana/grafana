import { newDBClusterService } from '../../../../../dbaas/components/DBCluster/DBCluster.utils';
import { Databases } from '../../../types';
const clustersToModel = (database, clusters, kubernetes, index) => clusters.map((cluster) => {
    return newDBClusterService(database).toModel(cluster, kubernetes[index].kubernetesClusterName, database);
});
export const formatDBClusters = (results, kubernetes) => {
    return results.reduce((acc, r, index) => {
        var _a, _b;
        const pxcClusters = (_a = r.pxc_clusters) !== null && _a !== void 0 ? _a : [];
        const psmdbClusters = (_b = r.psmdb_clusters) !== null && _b !== void 0 ? _b : [];
        const pxcClustersModel = clustersToModel(Databases.mysql, pxcClusters, kubernetes, index);
        const psmdbClustersModel = clustersToModel(Databases.mongodb, psmdbClusters, kubernetes, index);
        return acc.concat([...pxcClustersModel, ...psmdbClustersModel]);
    }, []);
};
//# sourceMappingURL=dbClusters.utils.js.map