import { __awaiter } from "tslib";
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withAppEvents } from '../../../../../../features/alerting/unified/utils/redux';
import { KubernetesService } from '../../../../../dbaas/components/Kubernetes/Kubernetes.service';
import { SETTINGS_TIMEOUT } from '../../../constants';
import { updateSettingsAction } from '../../index';
export const initialDBClustersState = {
    result: undefined,
    loading: undefined,
};
const perconaK8SClusterSlice = createSlice({
    name: 'perconaK8SCluster',
    initialState: initialDBClustersState,
    reducers: {
        setAddK8SClusterResult: (state, { payload }) => (Object.assign(Object.assign({}, state), { result: payload, loading: false })),
        setAddK8SClusterLoading: (state, { payload }) => (Object.assign(Object.assign({}, state), { loading: payload })),
        resetAddK8SClusterState: (state) => {
            return initialDBClustersState;
        },
    },
});
export const addKubernetesAction = createAsyncThunk('percona/addKubernetes', (args, thunkAPI) => __awaiter(void 0, void 0, void 0, function* () {
    thunkAPI.dispatch(setAddK8SClusterLoading(true));
    if (args.setPMMAddress) {
        yield thunkAPI.dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
        yield new Promise((resolve) => setTimeout(resolve, SETTINGS_TIMEOUT));
    }
    yield withAppEvents(KubernetesService.addKubernetes(args.kubernetesToAdd, args.token), {
        successMessage: 'Cluster was successfully registered',
    })
        .then(() => {
        thunkAPI.dispatch(setAddK8SClusterResult('ok'));
    })
        .catch(() => {
        thunkAPI.dispatch(setAddK8SClusterResult('error'));
    });
}));
export const { setAddK8SClusterResult, resetAddK8SClusterState, setAddK8SClusterLoading } = perconaK8SClusterSlice.actions;
export default perconaK8SClusterSlice.reducer;
//# sourceMappingURL=k8sCluster.js.map