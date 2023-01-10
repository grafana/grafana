import { DBCluster, GetDBClustersAction } from '../DBCluster.types';

export interface DBClusterActionsProps {
  dbCluster: DBCluster;
  setDeleteModalVisible: (isVisible: boolean) => void;
  setLogsModalVisible: (isVisible: boolean) => void;
  setUpdateModalVisible: (isVisible: boolean) => void;
  getDBClusters: GetDBClustersAction;
}
