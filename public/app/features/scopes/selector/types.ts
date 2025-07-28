import { Scope, ScopeNode } from '@grafana/data';

export type NodesMap = Record<string, ScopeNode>;
export type ScopesMap = Record<string, Scope>;

export interface SelectedScope {
  scopeId: string;
  scopeNodeId?: string;
}

export interface TreeNode {
  scopeNodeId: string;
  expanded: boolean;
  query: string;
  children?: Record<string, TreeNode>;
}
export interface RecentScope extends Scope {
  parentNode?: {
    // id of the parent node
    name: string;
    // display title
    title: string;
  };
}
