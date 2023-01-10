import { DBCluster } from '../DBCluster.types';

export interface DBClusterStatusProps {
  dbCluster: DBCluster;
  setLogsModalVisible: (isVisible: boolean) => void;
}
