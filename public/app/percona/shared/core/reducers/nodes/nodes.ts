import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CancelToken } from 'axios';

import { InventoryService, RemoveNodeBody } from 'app/percona/inventory/Inventory.service';
import { filterFulfilled, processPromiseResults } from 'app/percona/shared/helpers/promises';
import { Node } from 'app/percona/shared/services/nodes/Nodes.types';

import { NodesState, RemoveNodesParams } from './nodes.types';
import { toDbNodesModel } from './nodes.utils';

const initialState: NodesState = {
  nodes: [],
  isLoading: false,
};

const nodesSlice = createSlice({
  name: 'nodes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchNodesAction.pending, (state) => ({
      ...state,
      isLoading: true,
    }));
    builder.addCase(fetchNodesAction.rejected, (state) => ({
      ...state,
      isLoading: false,
    }));
    builder.addCase(fetchNodesAction.fulfilled, (state, action) => ({
      ...state,
      nodes: action.payload,
      isLoading: false,
    }));
  },
});

export const fetchNodesAction = createAsyncThunk<Node[], { token?: CancelToken }>(
  'percona/fetchNodes',
  async (params = {}) => {
    const nodes = await InventoryService.getNodes(params.token);
    return toDbNodesModel(nodes);
  }
);

export const removeNodesAction = createAsyncThunk(
  'percona/removeNodes',
  async (params: RemoveNodesParams): Promise<number> => {
    const bodies: RemoveNodeBody[] = params.nodes.map(({ nodeId, force }) => ({ node_id: nodeId, force }));
    const requests = bodies.map((body) => InventoryService.removeNode(body, params.cancelToken));
    const results = await processPromiseResults(requests);
    return results.filter(filterFulfilled).length;
  }
);

export default nodesSlice.reducer;
