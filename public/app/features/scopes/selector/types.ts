import { type Scope, type ScopeNode } from '@grafana/data';

export type NodesMap = Record<string, ScopeNode>;
export type ScopesMap = Record<string, Scope>;

export interface SelectedScope {
  scopeId: string;
  scopeNodeId?: string;
  // TODO: remove - parentNodeId is never populated in production code and is not read by any service method
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

/**
 * A container node that sits at least two levels below root (i.e. reaching it today requires expanding more than
 * one menu) and has at least one selectable scope as a direct child. Shown at the top level of the selector as a
 * shortcut so users can jump straight to it instead of expanding every intermediate level.
 */
export interface QuickJumpGroup {
  scopeNodeId: string;
  // Ancestor scopeNodeIds from the top-level category down to and including this group (root excluded).
  path: string[];
}
