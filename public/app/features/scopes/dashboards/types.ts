import { ScopeDashboardBinding } from '@grafana/data';

export interface SuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedNavigation {
  title: string;
  url: string;
  // Used for testid and keys
  name: string;
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
