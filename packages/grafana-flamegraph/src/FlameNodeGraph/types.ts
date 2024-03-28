export type GraphNode = {
  label: string;
  self: number;
  value: number;
  parents: GraphEdge[];
  children: GraphEdge[];
};

export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  weight: number;
  // Residual means it is a skip level node. This happens as we trim the tree based on node priorities and sometimes
  // we remove intermediate node.
  residual: boolean;
};

export type GraphNodes = { [key: string]: GraphNode };
export type GraphEdges = { [key: string]: GraphEdge };
