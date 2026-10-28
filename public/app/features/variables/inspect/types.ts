import { type BaseVariableModel } from '@grafana/data';

export interface UsagesToNetwork {
  variable: BaseVariableModel;
  nodes: GraphNode[];
  edges: GraphEdge[];
  showGraph: boolean;
}

export interface VariableUsageTree {
  variable: BaseVariableModel;
  tree: object;
}

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}
