export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export interface ScopeFilter {
  key: string;
  value: string;
  operator: string;
}

export interface Scope {
  uid: string;
  title: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeFilter[];
}
