import type { BaseVariableModel } from '@grafana/data/types';

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

export interface VariableUsages {
  unUsed: BaseVariableModel[];
  usages: VariableUsageTree[];
}

export interface GraphNode {
  id: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}
