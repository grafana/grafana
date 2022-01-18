import { DBCluster } from '../DBCluster.types';

export interface UpdateDBClusterModalProps {
  dbCluster: DBCluster;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  setLoading: (loading: boolean) => void;
  onUpdateFinished: () => void;
}
