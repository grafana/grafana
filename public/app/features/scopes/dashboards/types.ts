import { ScopeDashboardBinding } from '@grafana/data';

// TODO: replace with generate API client types
export interface ScopeNavigationSpec {
  url: string;
  scope: string;
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
}

export interface SuggestedNavigationsFolder {
  title: string;
  expanded: boolean;
  folders: SuggestedNavigationsFoldersMap;
  suggestedNavigations: SuggestedNavigationsMap;
}

export type SuggestedNavigationsFoldersMap = Record<string, SuggestedNavigationsFolder>;
export type SuggestedNavigationsMap = Record<string, SuggestedNavigation>;
export type OnFolderUpdate = (path: string[], expanded: boolean) => void;
