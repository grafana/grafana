import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { withSerializedError } from '../../../../../../features/alerting/unified/utils/redux';
import { KubernetesService } from '../../../../../dbaas/components/Kubernetes/Kubernetes.service';

import { PerconaK8SClusterListState } from './k8sClusterList.types';
import { toKubernetesListModel } from './k8sClusterList.utils';

export const initialDBClustersState: PerconaK8SClusterListState = {
  result: undefined,
  loading: undefined,
};

const perconaK8SClusterListSlice = createSlice({
  name: 'perconaK8SClusterList',
  initialState: initialDBClustersState,
  reducers: {
    setK8SClusterListResult: (state, { payload }): PerconaK8SClusterListState => ({
      ...state,
      result: payload,
      loading: false,
    }),
    setK8SClusterListLoading: (state, { payload }): PerconaK8SClusterListState => ({
      ...state,
      loading: payload,
    }),
    resetK8SClusterListState: (state): PerconaK8SClusterListState => {
      return initialDBClustersState;
    },
  },
});

export const fetchK8sListAction = createAsyncThunk(
  'percona/fetchKubernetes',
  (args: { tokens?: { kubernetes?: CancelToken; operator?: CancelToken } }, thunkAPI): Promise<void> =>
    withSerializedError(
      (async () => {
        thunkAPI.dispatch(setK8SClusterListLoading(true));
        const [results, checkUpdateResults] = await Promise.all([
          KubernetesService.getKubernetes(args?.tokens?.kubernetes),
          KubernetesService.checkForOperatorUpdate(args?.tokens?.operator),
        ]);

        thunkAPI.dispatch(setK8SClusterListResult(toKubernetesListModel(results, checkUpdateResults)));
      })()
    )
);

export const { setK8SClusterListResult, resetK8SClusterListState, setK8SClusterListLoading } =
  perconaK8SClusterListSlice.actions;
export default perconaK8SClusterListSlice.reducer;
