import { Instance } from '../../Discovery.types';

export interface InstancesTableProps {
  instances: Instance[];
  selectInstance: (any) => void;
  loading: boolean;
  credentials: any;
}
