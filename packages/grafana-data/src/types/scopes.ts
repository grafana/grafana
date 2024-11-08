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

export enum InternalScopeNodeReason {
  Persisted,
  Result,
}

export interface InternalScopeNode extends ScopeNodeSpec {
  name: string;
  reason: InternalScopeNodeReason;
  isExpandable: boolean;
  isSelectable: boolean;
  isExpanded: boolean;
  query: string;
  nodes: InternalScopeNodesMap;
}

export type InternalScopeNodesMap = Record<string, InternalScopeNode>;

export interface InternalSelectedScope {
  scope: Scope;
  path: string[];
}

export interface InternalTreeScope {
  scopeName: string;
  path: string[];
}

export interface InternalSuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface InternalSuggestedDashboardsFolder {
  title: string;
  isExpanded: boolean;
  folders: InternalSuggestedDashboardsFoldersMap;
  dashboards: InternalSuggestedDashboardsMap;
}

export type InternalSuggestedDashboardsMap = Record<string, InternalSuggestedDashboard>;
export type InternalSuggestedDashboardsFoldersMap = Record<string, InternalSuggestedDashboardsFolder>;
