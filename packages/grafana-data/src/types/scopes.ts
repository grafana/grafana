export interface ScopeDashboard {
  uid: string;
  title: string;
}

export interface ScopeFilter {
  key: string;
  value: string;
  operator: string;
}

export interface Scope {
  name: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeFilter[];
}
