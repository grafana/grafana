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

export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type ScopeFilter = ScopeSpecFilter;

export interface Scope extends ScopeSpec {
  name: string;
  filters: ScopeFilter[];
}
