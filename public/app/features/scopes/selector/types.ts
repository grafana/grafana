import { Scope, ScopeNodeSpec } from '@grafana/data';

export enum NodeReason {
  Persisted,
  Result,
}

export interface Node extends ScopeNodeSpec {
  name: string;
  reason: NodeReason;
  expandable: boolean;
  selectable: boolean;
  expanded: boolean;
  query: string;
  nodes: NodesMap;
}

export type NodesMap = Record<string, Node>;

export interface SelectedScope {
  scope: Scope;
  path: string[];
}

export interface TreeScope {
  title: string;
  scopeName: string;
  path: string[];
}

// Sort of partial treeScope that is used as a way to say which node should be toggled.
export type ToggleNode = { scopeName: string; path?: string[] } | { path: string[]; scopeName?: string };

export type OnNodeUpdate = (path: string[], expanded: boolean, query: string) => void;
export type OnNodeSelectToggle = (node: ToggleNode) => void;
