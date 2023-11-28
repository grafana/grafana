import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withAppEvents } from '../../../../../../features/alerting/unified/utils/redux';
import { newDBClusterService } from '../../../../../dbaas/components/DBCluster/DBCluster.utils';
import { prepareSourceRanges } from '../dbaas.utils';
export const initialUpdateDBClusterState = {
    result: undefined,
    loading: undefined,
};
const perconaUpdateDBClusterSlice = createSlice({
    name: 'perconaUpdateDBCluster',
    initialState: initialUpdateDBClusterState,
    reducers: {
        resetUpdateDBClusterState: (state) => {
            return Object.assign(Object.assign({}, state), { result: undefined, loading: undefined });
        },
        setUpdateDBClusterLoading: (state) => {
            return Object.assign(Object.assign({}, state), { loading: true });
        },
        setUpdateDBClusterResult: (state, action) => {
            return Object.assign(Object.assign({}, state), { result: action.payload, loading: false });
        },
    },
});
export const updateDBClusterAction = createAsyncThunk('percona/updateDBCluster', (args, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    const { cpu, memory, disk, nodes, configuration, sourceRanges, expose, internetFacing, storageClass, template } = args.values;
    const { selectedDBCluster } = args;
    const dbClusterService = newDBClusterService(selectedDBCluster.databaseType);
    thunkAPI.dispatch(setUpdateDBClusterLoading());
    const preparedSourceRanges = prepareSourceRanges(sourceRanges);
    yield withAppEvents(dbClusterService.updateDBCluster(Object.assign(Object.assign({ databaseImage: selectedDBCluster.installedImage, databaseType: selectedDBCluster.databaseType, clusterName: selectedDBCluster.clusterName, kubernetesClusterName: selectedDBCluster.kubernetesClusterName, clusterSize: nodes, cpu,
        memory,
        disk, expose: !!expose, internetFacing: !!expose && !!internetFacing, configuration, sourceRanges: preparedSourceRanges }, ((storageClass === null || storageClass === void 0 ? void 0 : storageClass.value) && { storageClass: storageClass === null || storageClass === void 0 ? void 0 : storageClass.value })), (template && {
        template: {
            name: template.label,
            kind: template.value,
        },
    }))), {
        successMessage: 'Cluster was successfully updated',
    })
        .then(() => {
        thunkAPI.dispatch(setUpdateDBClusterResult('ok'));
    })
        .catch(() => {
        thunkAPI.dispatch(setUpdateDBClusterResult('error'));
    });
}));
export const { setUpdateDBClusterLoading, resetUpdateDBClusterState, setUpdateDBClusterResult } = perconaUpdateDBClusterSlice.actions;
export default perconaUpdateDBClusterSlice.reducer;
//# sourceMappingURL=updateDBCluster.js.map