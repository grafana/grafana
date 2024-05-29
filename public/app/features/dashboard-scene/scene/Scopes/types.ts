import { ScopeTreeItemSpec } from '@grafana/data';

export interface Node {
  item: ScopeTreeItemSpec;
  isExpandable: boolean;
  isSelectable: boolean;
  isExpanded: boolean;
  query: string;
  nodes: NodesMap;
}

export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type NodesMap = Record<string, Node>;
