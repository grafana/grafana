import { ScopeTreeItemSpec } from '@grafana/data';

export interface Node {
  item: ScopeTreeItemSpec;
  hasChildren: boolean;
  isSelectable: boolean;
  children: NodesMap;
}

export interface ExpandedNode {
  nodeId: string;
  query: string;
}

export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type NodesMap = Record<string, Node>;
