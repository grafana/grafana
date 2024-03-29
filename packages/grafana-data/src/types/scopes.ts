export interface APIScopeDashboardBinding {
  dashboard: string;
  scope: string;
}

export interface APIScopeFilter {
  key: string;
  value: string;
  operator: string;
}

export interface APIScope {
  title: string;
  type: string;
  description: string;
  category: string;
  filters: APIScopeFilter[];
}

export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type ScopeFilter = APIScopeFilter;

export interface Scope extends APIScope {
  name: string;
  filters: ScopeFilter[];
}
