import { ScopeDashboardBinding } from '@grafana/data';

export interface SuggestedDashboard {
  dashboard: string;
  dashboardTitle: string;
  items: ScopeDashboardBinding[];
}

export interface SuggestedDashboardsFolder {
  title: string;
  isExpanded: boolean;
  folders: SuggestedDashboardsFoldersMap;
  dashboards: SuggestedDashboardsMap;
}

export type SuggestedDashboardsMap = Record<string, SuggestedDashboard>;
export type SuggestedDashboardsFoldersMap = Record<string, SuggestedDashboardsFolder>;

export type OnFolderUpdate = (path: string[], isExpanded: boolean) => void;
