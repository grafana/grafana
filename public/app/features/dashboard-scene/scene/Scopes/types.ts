import { ScopeTreeItemSpec } from '@grafana/data';

export interface Node {
  item: ScopeTreeItemSpec;
  isExpandable: boolean;
  isSelectable: boolean;
  isExpanded: boolean;
  query: string;
  nodes: NodesMap;
}

export type NodesMap = Record<string, Node>;
