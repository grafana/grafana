import { DBCluster } from '../DBCluster.types';

export interface DBClusterStatusProps {
  setSelectedCluster: (dbCluster: DBCluster) => void;
  setLogsModalVisible: (isVisible: boolean) => void;
}
