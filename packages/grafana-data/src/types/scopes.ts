export interface ScopeDashboardBinding {
  dashboard: string;
  scope: string;
}

export interface ScopeBindingFilter {
  key: string;
  value: string;
  operator: string;
}

export interface ScopeBinding {
  title: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeBindingFilter[];
}

export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type ScopeFilter = ScopeBindingFilter;

export interface Scope extends ScopeBinding {
  name: string;
  filters: ScopeFilter[];
}
