import { Scope, ScopeDashboardBinding, ScopeNodeSpec } from '@grafana/data';

export enum NodeReason {
  Persisted,
  Result,
}

export interface Node extends ScopeNodeSpec {
  name: string;
  reason: NodeReason;
  isExpandable: boolean;
  isSelectable: boolean;
  isExpanded: boolean;
  query: string;
  nodes: NodesMap;
}

export type NodesMap = Record<string, Node>;

export interface SelectedScope {
  scope: Scope;
  path: string[];
}

export interface TreeScope {
  scopeName: string;
  path: string[];
}

export interface SuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedDashboardsFolder {
  title: string;
  isExpanded: boolean;
  folders: SuggestedDashboardsFoldersMap;
  dashboards: SuggestedDashboardsMap;
}

export type SuggestedDashboardsMap = Record<string, SuggestedDashboard>;
export type SuggestedDashboardsFoldersMap = Record<string, SuggestedDashboardsFolder>;

export type OnNodeUpdate = (path: string[], isExpanded: boolean, query: string) => void;
export type OnNodeSelectToggle = (path: string[]) => void;
export type OnFolderUpdate = (path: string[], isExpanded: boolean) => void;
