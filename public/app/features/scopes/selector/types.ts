import { type Scope, type ScopeNode } from '@grafana/data';

export type NodesMap = Record<string, ScopeNode>;
export type ScopesMap = Record<string, Scope>;

export interface SelectedScope {
  scopeId: string;
  scopeNodeId?: string;
  // Used for recent scopes functionality when scope node isn't loaded yet
  parentNodeId?: string;
}

export interface TreeNode {
  scopeNodeId: string;
  expanded: boolean;
  query: string;
  children?: Record<string, TreeNode>;
  // Check if we have loaded all the children. Used when resolving to root.
  childrenLoaded?: boolean;
}

export interface RecentScopeSet {
  scopeIds: string[];
  scopes: Array<{ id: string; title: string }>;
  scopeNodeId?: string;
  parentNodeTitle?: string;
}
