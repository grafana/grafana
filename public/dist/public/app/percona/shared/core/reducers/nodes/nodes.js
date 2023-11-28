import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { nodeFromDbMapper } from './nodes.utils';
const initialState = {
    nodes: [],
    isLoading: false,
};
const nodesSlice = createSlice({
    name: 'nodes',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchNodesAction.pending, (state) => (Object.assign(Object.assign({}, state), { isLoading: true })));
        builder.addCase(fetchNodesAction.rejected, (state) => (Object.assign(Object.assign({}, state), { isLoading: false })));
        builder.addCase(fetchNodesAction.fulfilled, (state, action) => (Object.assign(Object.assign({}, state), { nodes: action.payload, isLoading: false })));
    },
});
export const fetchNodesAction = createAsyncThunk('percona/fetchNodes', (params = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const { nodes } = yield InventoryService.getNodes(params.token);
    const mappedNodes = nodeFromDbMapper(nodes);
    return mappedNodes.sort((a, b) => a.nodeName.localeCompare(b.nodeName));
}));
export const removeNodesAction = createAsyncThunk('percona/removeNodes', (params) => __awaiter(void 0, void 0, void 0, function* () {
    const bodies = params.nodes.map(({ nodeId, force }) => ({ node_id: nodeId, force }));
    const requests = bodies.map((body) => InventoryService.removeNode(body, params.cancelToken));
    const results = yield processPromiseResults(requests);
    return results.filter(filterFulfilled).length;
}));
export default nodesSlice.reducer;
//# sourceMappingURL=nodes.js.map