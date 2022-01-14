import { DBClusterStatus } from '../DBCluster.types';

export interface DBClusterStatusProps {
  status: DBClusterStatus;
  message?: string;
  finishedSteps?: number;
  totalSteps?: number;
}
