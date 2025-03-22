import { ScopeDashboardBinding } from '@grafana/data';

export interface SuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedNavigation {
  title: string;
  groups: string[];
  url: string;
}

export interface SuggestedDashboardsFolder {
  title: string;
  expanded: boolean;
  folders: SuggestedDashboardsFoldersMap;
  suggestedNavigations: SuggestedNavigationsMap;
  dashboards: SuggestedDashboardsMap;
}

export type SuggestedDashboardsMap = Record<string, SuggestedDashboard>;
export type SuggestedDashboardsFoldersMap = Record<string, SuggestedDashboardsFolder>;
export type SuggestedNavigationsMap = Record<string, SuggestedNavigation>;
export type OnFolderUpdate = (path: string[], expanded: boolean) => void;
