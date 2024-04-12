export interface ScopeDashboard {
  uid: string;
  title: string;
  url: string;
}

export type ScopeFilterOperator = 'equals' | 'not-equals' | 'regex-match' | 'regex-not-match';

export interface ScopeFilter {
  key: string;
  value: string;
  operator: ScopeFilterOperator;
}

export interface Scope {
  uid: string;
  title: string;
  type: string;
  description: string;
  category: string;
  filters: ScopeFilter[];
}
