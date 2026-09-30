import { type BaseVariableModel } from '@grafana/data';

export type UnknownVariable = Pick<BaseVariableModel, 'id' | 'name'>;

export interface UsagesToNetwork<TVariable extends UnknownVariable = BaseVariableModel> {
  variable: TVariable;
  nodes: GraphNode[];
  edges: GraphEdge[];
  showGraph: boolean;
}

export interface VariableUsageTree<TVariable extends UnknownVariable = BaseVariableModel> {
  variable: TVariable;
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
