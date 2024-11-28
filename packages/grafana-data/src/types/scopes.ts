export interface ScopeDashboardBindingSpec {
  dashboard: string;
  scope: string;
}

export interface ScopeDashboardBindingStatus {
  dashboardTitle: string;
  groups?: string[];
}

// TODO: Use Resource from apiserver when we export the types
export interface ScopeDashboardBinding {
  metadata: {
    name: string;
  };
  spec: ScopeDashboardBindingSpec;
  status: ScopeDashboardBindingStatus;
}

export type ScopeFilterOperator = 'equals' | 'not-equals' | 'regex-match' | 'regex-not-match' | 'one-of' | 'not-one-of';

export const scopeFilterOperatorMap: Record<string, ScopeFilterOperator> = {
  '=': 'equals',
  '!=': 'not-equals',
  '=~': 'regex-match',
  '!~': 'regex-not-match',
  '=|': 'one-of',
  '!=|': 'not-one-of',
};

export interface ScopeSpecFilter {
  key: string;
  value: string;
  // values is used for operators that support multiple values (e.g. one-of, not-one-of)
  values?: string[];
  operator: ScopeFilterOperator;
}

export interface ScopeSpec {
  title: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeSpecFilter[];
}

// TODO: Use Resource from apiserver when we export the types
export interface Scope {
  metadata: {
    name: string;
  };
  spec: ScopeSpec;
}

export type ScopeNodeNodeType = 'container' | 'leaf';
export type ScopeNodeLinkType = 'scope';

export interface ScopeNodeSpec {
  nodeType: ScopeNodeNodeType;
  title: string;

  description?: string;
  disableMultiSelect?: boolean;
  linkId?: string;
  linkType?: ScopeNodeLinkType;
}

// TODO: Use Resource from apiserver when we export the types
export interface ScopeNode {
  metadata: {
    name: string;
  };
  spec: ScopeNodeSpec;
}

export enum ScopesNodesMapItemReason {
  Persisted,
  Result,
}

export interface ScopesNodesMapItem extends ScopeNodeSpec {
  name: string;
  reason: ScopesNodesMapItemReason;
  isExpandable: boolean;
  isSelectable: boolean;
  isExpanded: boolean;
  query: string;
  nodes: ScopesNodesMap;
}

export type ScopesNodesMap = Record<string, ScopesNodesMapItem>;

export interface SelectedScope {
  scope: Scope;
  path: string[];
}

export interface TreeScope {
  scopeName: string;
  path: string[];
}

export interface SuggestedDashboardsMapItem {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedDashboardsFoldersMapItem {
  title: string;
  isExpanded: boolean;
  folders: SuggestedDashboardsFoldersMap;
  dashboards: SuggestedDashboardsMap;
}

export type SuggestedDashboardsMap = Record<string, SuggestedDashboardsMapItem>;
export type SuggestedDashboardsFoldersMap = Record<string, SuggestedDashboardsFoldersMapItem>;
