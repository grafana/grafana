export interface ScopeDashboardBindingSpec {
  dashboard: string;
  dashboardTitle: string;
  scope: string;
}

// TODO: Use Resource from apiserver when we export the types
export interface ScopeDashboardBinding {
  metadata: {
    name: string;
  };
  spec: ScopeDashboardBindingSpec;
}

export type ScopeFilterOperator = 'equals' | 'not-equals' | 'regex-match' | 'regex-not-match';

export const scopeFilterOperatorMap: Record<string, ScopeFilterOperator> = {
  '=': 'equals',
  '!=': 'not-equals',
  '=~': 'regex-match',
  '!~': 'regex-not-match',
};

export interface ScopeSpecFilter {
  key: string;
  value: string;
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
