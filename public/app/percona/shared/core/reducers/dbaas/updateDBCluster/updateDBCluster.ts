import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { withAppEvents } from '../../../../../../features/alerting/unified/utils/redux';
import { DBCluster } from '../../../../../dbaas/components/DBCluster/DBCluster.types';
import { newDBClusterService } from '../../../../../dbaas/components/DBCluster/DBCluster.utils';
import { DBClusterTopology } from '../../../../../dbaas/components/DBCluster/EditDBClusterPage/DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';

import { PerconaUpdateDBClusterState } from './updateDBCluster.types';

export const initialUpdateDBClusterState: PerconaUpdateDBClusterState = {
  result: undefined,
  loading: undefined,
};

const perconaUpdateDBClusterSlice = createSlice({
  name: 'perconaUpdateDBCluster',
  initialState: initialUpdateDBClusterState,
  reducers: {
    resetUpdateDBClusterState: (state): PerconaUpdateDBClusterState => {
      return {
        ...state,
        result: undefined,
        loading: undefined,
      };
    },
    setUpdateDBClusterLoading: (state): PerconaUpdateDBClusterState => {
      return {
        ...state,
        loading: true,
      };
    },
    setUpdateDBClusterResult: (state, action): PerconaUpdateDBClusterState => {
      return {
        ...state,
        result: action.payload,
        loading: false,
      };
    },
  },
});

export const updateDBClusterAction = createAsyncThunk(
  'percona/updateDBCluster',
  async (args: { values: Record<string, any>; selectedDBCluster: DBCluster }, thunkAPI): Promise<void> => {
    const { cpu, memory, disk, nodes, single, topology } = args.values;
    const { selectedDBCluster } = args;

    const dbClusterService = newDBClusterService(selectedDBCluster.databaseType);
    thunkAPI.dispatch(setUpdateDBClusterLoading());

    await withAppEvents(
      dbClusterService.updateDBCluster({
        databaseImage: selectedDBCluster.installedImage,
        databaseType: selectedDBCluster.databaseType,
        clusterName: selectedDBCluster.clusterName,
        kubernetesClusterName: selectedDBCluster.kubernetesClusterName,
        clusterSize: topology === DBClusterTopology.cluster ? nodes : single,
        cpu,
        memory,
        disk,
      }),
      {
        successMessage: 'Cluster was successfully updated',
      }
    )
      .then(() => {
        thunkAPI.dispatch(setUpdateDBClusterResult('ok'));
      })
      .catch(() => {
        thunkAPI.dispatch(setUpdateDBClusterResult('error'));
      });
  }
);

export const { setUpdateDBClusterLoading, resetUpdateDBClusterState, setUpdateDBClusterResult } =
  perconaUpdateDBClusterSlice.actions;
export default perconaUpdateDBClusterSlice.reducer;
