import { __awaiter } from "tslib";
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { withSerializedError } from '../../../../../../features/alerting/unified/utils/redux';
import { DBClusterService } from '../../../../../dbaas/components/DBCluster/DBCluster.service';
import { formatDBClusters } from './dbClusters.utils';
export const initialDBClustersState = {
    result: [],
    loading: undefined,
    credentialsLoading: undefined,
};
const perconaDBClustersSlice = createSlice({
    name: 'perconaDBClusters',
    initialState: initialDBClustersState,
    reducers: {
        resetDBClustersToInitial: (state) => (Object.assign(Object.assign({}, state), { result: [] })),
        setDBClusters: (state, action) => {
            return Object.assign(Object.assign({}, state), { result: action.payload, loading: false });
        },
        setDBClustersLoading: (state) => {
            return Object.assign(Object.assign({}, state), { loading: true });
        },
    },
});
export const fetchDBClustersAction = createAsyncThunk('percona/fetchDBClusters', (args, thunkAPI) => withSerializedError((() => __awaiter(void 0, void 0, void 0, function* () {
    thunkAPI.dispatch(setDBClustersLoading());
    const requests = args.kubernetes.map((k, idx) => DBClusterService.getDBClusters(k, args.tokens[idx]));
    const promises = yield Promise.all(requests);
    const dbClusters = formatDBClusters(promises, args.kubernetes);
    thunkAPI.dispatch(setDBClusters(dbClusters));
}))()));
export const { setDBClusters, setDBClustersLoading } = perconaDBClustersSlice.actions;
export default perconaDBClustersSlice.reducer;
//# sourceMappingURL=dbClusters.js.map