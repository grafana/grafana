export interface ScopeDashboardBindingSpec {
  dashboard: string;
  scope: string;
}

export interface ScopeSpecFilter {
  key: string;
  value: string;
  operator: string;
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
