import { ScopeDashboardBinding } from '@grafana/data';

// TODO: replace with generate API client types
export interface ScopeNavigationSpec {
  url: string;
  scope: string;
  subScope?: string;
}

export interface ScopeNavigationStatus {
  title: string;
  groups?: string[];
}

export interface ScopeNavigation {
  metadata: {
    name: string;
  };
  spec: ScopeNavigationSpec;
  status: ScopeNavigationStatus;
}

export interface SuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedNavigation {
  title: string;
  url: string;
  // Used for testid and keys
  id: string;
  hasSubScope?: boolean;
}

export interface SuggestedNavigationsFolder {
  title: string;
  expanded: boolean;
  folders: SuggestedNavigationsFoldersMap;
  suggestedNavigations: SuggestedNavigationsMap;
  isSubScope?: boolean;
  subScopeName?: string;
}

export type SuggestedNavigationsFoldersMap = Record<string, SuggestedNavigationsFolder>;
export type SuggestedNavigationsMap = Record<string, SuggestedNavigation>;
export type OnFolderUpdate = (path: string[], expanded: boolean) => void | Promise<void>;
