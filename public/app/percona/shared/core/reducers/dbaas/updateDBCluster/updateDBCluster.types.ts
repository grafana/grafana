import { EditDBClusterFormValues } from '../../../../../dbaas/components/DBCluster/EditDBClusterPage/EditDBClusterPage.types';

export interface PerconaUpdateDBClusterState {
  result?: 'ok' | 'error';
  loading?: boolean;
}

export interface UpdateDBClusterValues extends EditDBClusterFormValues {}
