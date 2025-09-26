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
export type EqualityOrMultiOperator = Extract<ScopeFilterOperator, 'equals' | 'not-equals' | 'one-of' | 'not-one-of'>;

export function isEqualityOrMultiOperator(value: string): value is EqualityOrMultiOperator {
  const operators = new Set(['equals', 'not-equals', 'one-of', 'not-one-of']);
  return operators.has(value);
}

export const scopeFilterOperatorMap: Record<string, ScopeFilterOperator> = {
  '=': 'equals',
  '!=': 'not-equals',
  '=~': 'regex-match',
  '!~': 'regex-not-match',
  '=|': 'one-of',
  '!=|': 'not-one-of',
};

export const reverseScopeFilterOperatorMap: Record<ScopeFilterOperator, string> = Object.fromEntries(
  Object.entries(scopeFilterOperatorMap).map(([symbol, operator]) => [operator, symbol])
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
) as Record<ScopeFilterOperator, string>;

export interface ScopeSpecFilter {
  key: string;
  value: string;
  // values is used for operators that support multiple values (e.g. one-of, not-one-of)
  values?: string[];
  operator: ScopeFilterOperator;
}

export interface ScopeSpec {
  title: string;
  // Used to display the title next to the selected scope and expand the selector to the proper path.
  // This will override whichever is selected from in the selector.
  defaultPath?: string[];
  filters?: ScopeSpecFilter[];
}

// TODO: Use Resource from apiserver when we export the types
export interface Scope {
  metadata: {
    // Name is actually the ID of the resource, use spec.title for user readable string
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

  // If true for a scope category/type, it means only single child can be selected at a time.
  disableMultiSelect?: boolean;

  // Id of a scope this node links to. Can be blank for nodes only representing category/type.
  linkId?: string;
  // Right now only scope can be linked but in the future this may be other types.
  linkType?: ScopeNodeLinkType;

  // Id of the parent node.
  parentName?: string;
}

// TODO: Use Resource from apiserver when we export the types
// Scope node represents a node in a tree that is shown to users. Each node can be a category/type with more children
// nodes and/or (meaning some can be both) a node representing a selectable scope. Each node can link to a scope but
// multiple nodes can link to the same scope, meaning a scope is part of multiple categories/types.
export interface ScopeNode {
  metadata: {
    // Name is actually the ID of the resource, use spec.title for user readable string
    name: string;
  };
  spec: ScopeNodeSpec;
}
