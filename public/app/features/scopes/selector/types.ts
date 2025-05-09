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

export interface TreeScope {
  title: string;
  scopeName: string;
  path: string[];
}

// Sort of partial treeScope that is used as a way to say which node should be toggled.
export type ToggleNode = { scopeName: string; path?: string[] } | { path: string[]; scopeName?: string };
