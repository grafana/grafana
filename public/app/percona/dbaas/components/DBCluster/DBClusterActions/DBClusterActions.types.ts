import { DBCluster, GetDBClustersAction } from '../DBCluster.types';

export interface DBClusterActionsProps {
  dbCluster: DBCluster;
  setSelectedCluster: (dbCluster: DBCluster) => void;
  setDeleteModalVisible: (isVisible: boolean) => void;
  setEditModalVisible: (isVisible: boolean) => void;
  setLogsModalVisible: (isVisible: boolean) => void;
  setUpdateModalVisible: (isVisible: boolean) => void;
  getDBClusters: GetDBClustersAction;
}
