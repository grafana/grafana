import { RawTimeRange, TimeRange } from '@grafana/data';

export interface PageHistoryState {}

export interface VistedAppView {
  name: string;
  url: string;
  timeRange?: RawTimeRange;
}

export interface VisitedApp {
  name: string;
  url: string;
  views: VistedAppView[];
}
