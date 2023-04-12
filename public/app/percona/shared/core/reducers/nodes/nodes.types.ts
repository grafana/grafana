import { CancelToken } from 'axios';

import { Node } from 'app/percona/shared/services/nodes/Nodes.types';

export interface NodesState {
  nodes: Node[];
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
