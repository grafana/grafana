import { NavModelItem } from '@grafana/data';

export interface ToolbarUpdateProps {
  pageNav?: NavModelItem;
  actions?: React.ReactNode;
}

export interface HistoryEntryView {
  name: string;
  description: string;
  url: string;
  time: number;
}

export interface HistoryEntrySparkline {
  values: number[];
  range: {
    min: number;
    max: number;
    delta: number;
  };
}

export interface HistoryEntry {
  name: string;
  time: number;
  breadcrumbs: NavModelItem[];
  url: string;
  views: HistoryEntryView[];
  sparklineData?: HistoryEntrySparkline;
}
