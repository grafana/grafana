/* eslint implicit-arrow-linebreak: 0 */
import { Databases } from 'app/percona/shared/core';
export const DASHBOARD_URL_MAP = {
    [Databases.mysql]: (clusterName) => `/graph/d/pxc-cluster-summary/pxc-galera-cluster-summary?var-cluster=${clusterName}-pxc`,
    [Databases.mongodb]: (clusterName) => `/graph/d/mongodb-cluster-summary/mongodb-cluster-summary?var-cluster=${clusterName}`,
};
//# sourceMappingURL=DBClusterName.constants.js.map