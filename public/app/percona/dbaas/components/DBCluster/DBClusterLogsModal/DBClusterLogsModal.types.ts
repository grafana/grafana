import { DBCluster, DBClusterPodLogs } from '../DBCluster.types';

export interface DBClusterLogsModalProps {
  dbCluster: DBCluster | null;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
}

export interface DBClusterLogsMap {
  [key: string]: DBClusterPodLogs;
}
