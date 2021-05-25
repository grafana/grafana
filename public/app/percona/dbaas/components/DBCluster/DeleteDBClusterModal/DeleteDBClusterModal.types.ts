import { DBCluster } from '../DBCluster.types';

export interface DeleteDBClusterModalProps {
  selectedCluster?: DBCluster;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  setLoading: (loading: boolean) => void;
  onClusterDeleted: () => void;
}
