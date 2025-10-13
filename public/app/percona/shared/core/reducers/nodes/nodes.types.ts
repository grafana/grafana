import { CancelToken } from 'axios';

import { NodeDB } from 'app/percona/inventory/Inventory.types';

export interface NodesState {
  nodes: NodeDB[];
  isLoading: boolean;
}

export interface RemoveNodeParams {
  nodeId: string;
  force: boolean;
}

export interface RemoveNodesParams {
  nodes: RemoveNodeParams[];
  cancelToken?: CancelToken;
}
