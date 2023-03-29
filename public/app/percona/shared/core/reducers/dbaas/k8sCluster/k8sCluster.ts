import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { withAppEvents } from '../../../../../../features/alerting/unified/utils/redux';
import { KubernetesService } from '../../../../../dbaas/components/Kubernetes/Kubernetes.service';
import { NewKubernetesCluster } from '../../../../../dbaas/components/Kubernetes/Kubernetes.types';
import { SETTINGS_TIMEOUT } from '../../../constants';
import { updateSettingsAction } from '../../index';

import { PerconaK8SClusterState } from './k8sCluster.types';

export const initialDBClustersState: PerconaK8SClusterState = {
  result: undefined,
  loading: undefined,
};

const perconaK8SClusterSlice = createSlice({
  name: 'perconaK8SCluster',
  initialState: initialDBClustersState,
  reducers: {
    setAddK8SClusterResult: (state, { payload }): PerconaK8SClusterState => ({
      ...state,
      result: payload,
      loading: false,
    }),
    setAddK8SClusterLoading: (state, { payload }): PerconaK8SClusterState => ({
      ...state,
      loading: payload,
    }),
    resetAddK8SClusterState: (state): PerconaK8SClusterState => {
      return initialDBClustersState;
    },
  },
});

export const addKubernetesAction = createAsyncThunk(
  'percona/addKubernetes',
  async (
    args: { kubernetesToAdd: NewKubernetesCluster; setPMMAddress?: boolean; token?: CancelToken },
    thunkAPI
  ): Promise<void> => {
    thunkAPI.dispatch(setAddK8SClusterLoading(true));
    if (args.setPMMAddress) {
      await thunkAPI.dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
      await new Promise((resolve) => setTimeout(resolve, SETTINGS_TIMEOUT));
    }

    await withAppEvents(KubernetesService.addKubernetes(args.kubernetesToAdd, args.token), {
      successMessage: 'Cluster was successfully registered',
    })
      .then(() => {
        thunkAPI.dispatch(setAddK8SClusterResult('ok'));
      })
      .catch(() => {
        thunkAPI.dispatch(setAddK8SClusterResult('error'));
      });
  }
);

export const { setAddK8SClusterResult, resetAddK8SClusterState, setAddK8SClusterLoading } =
  perconaK8SClusterSlice.actions;
export default perconaK8SClusterSlice.reducer;
