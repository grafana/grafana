import { NavModelItem, RawTimeRange } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
export const TOP_BAR_LEVEL_HEIGHT = 40;

export interface ToolbarUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

export interface HistoryEntryAppView {
  name: string;
  description: string;
  url: string;
}

export interface HistoryEntryApp {
  name: string;
  time: number;
  breadcrumbs: NavModelItem[];
  views: HistoryEntryAppView[];
}
