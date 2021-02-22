import { DBCluster, DBClusterPodLogs } from '../DBCluster.types';

export interface DBClusterLogsModalProps {
  dbCluster: DBCluster | undefined;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
}

export interface DBClusterLogsMap {
  [key: string]: DBClusterPodLogs;
}
