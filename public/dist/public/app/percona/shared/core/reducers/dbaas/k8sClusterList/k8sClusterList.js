import { __awaiter } from "tslib";
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from '../../../../../../features/alerting/unified/utils/redux';
import { KubernetesService } from '../../../../../dbaas/components/Kubernetes/Kubernetes.service';
import { toKubernetesListModel } from './k8sClusterList.utils';
export const initialDBClustersState = {
    result: undefined,
    loading: undefined,
};
const perconaK8SClusterListSlice = createSlice({
    name: 'perconaK8SClusterList',
    initialState: initialDBClustersState,
    reducers: {
        setK8SClusterListResult: (state, { payload }) => (Object.assign(Object.assign({}, state), { result: payload, loading: false })),
        setK8SClusterListLoading: (state, { payload }) => (Object.assign(Object.assign({}, state), { loading: payload })),
        resetK8SClusterListState: (state) => {
            return initialDBClustersState;
        },
    },
});
export const fetchK8sListAction = createAsyncThunk('percona/fetchKubernetes', (args, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    thunkAPI.dispatch(setK8SClusterListLoading(true));
    const [results, checkUpdateResults] = yield Promise.all([
        KubernetesService.getKubernetes((_a = args === null || args === void 0 ? void 0 : args.tokens) === null || _a === void 0 ? void 0 : _a.kubernetes),
        KubernetesService.checkForOperatorUpdate((_b = args === null || args === void 0 ? void 0 : args.tokens) === null || _b === void 0 ? void 0 : _b.operator),
    ]);
    thunkAPI.dispatch(setK8SClusterListResult(toKubernetesListModel(results, checkUpdateResults)));
}))()));
export const { setK8SClusterListResult, resetK8SClusterListState, setK8SClusterListLoading } = perconaK8SClusterListSlice.actions;
export default perconaK8SClusterListSlice.reducer;
//# sourceMappingURL=k8sClusterList.js.map