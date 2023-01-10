import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DBCluster } from '../../../../dbaas/components/DBCluster/DBCluster.types';
import { Kubernetes } from '../../../../dbaas/components/Kubernetes/Kubernetes.types';

export interface PerconaDBaaSState {
  selectedKubernetesCluster: Kubernetes | null;
  selectedDBCluster: DBCluster | null;
}
export const initialDBaaSState: PerconaDBaaSState = {
  selectedKubernetesCluster: null,
  selectedDBCluster: null,
};

const perconaDBaaSSlice = createSlice({
  name: 'perconaDBaaS',
  initialState: initialDBaaSState,
  reducers: {
    selectKubernetesCluster: (state, action: PayloadAction<Kubernetes | null>): PerconaDBaaSState => ({
      ...state,
      selectedKubernetesCluster: action.payload,
    }),
    selectDBCluster: (state, action: PayloadAction<DBCluster | null>): PerconaDBaaSState => ({
      ...state,
      selectedDBCluster: action.payload,
    }),
    resetDBCluster: (state): PerconaDBaaSState => ({
      ...state,
      selectedDBCluster: null,
    }),
  },
});

export const { selectDBCluster, selectKubernetesCluster, resetDBCluster } = perconaDBaaSSlice.actions;
export default perconaDBaaSSlice.reducer;
