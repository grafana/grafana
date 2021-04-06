import { DashboardModel, PanelModel } from '../../state';

export interface CollectorData extends Record<string, any> {}
export interface Sanitizer {
  id: string;
  canSanitize: (item: CollectorItem) => boolean;
  sanitize: (item: CollectorItem) => CollectorData;
}

export interface CollectorItem {
  id: string;
  name: string;
  data: CollectorData;
}

export enum CollectorWorkers {
  os = 'OSCollectorWorker',
  browser = 'BrowserCollectorWorker',
  grafana = 'GrafanaCollectorWorker',
  dashboard = 'DashboardJsonCollectorWorker',
  panelJson = 'PanelJsonCollectorWorker',
  panelData = 'PanelDataCollectorWorker',
}

export enum CollectorType {
  Dashboard = 'dashboard', // when sharing data for a whole dashboard
  Panel = 'panel', // when sharing data for a panel only
}

export interface CollectOptions {
  dashboard: DashboardModel;
  panel?: PanelModel;
  type: CollectorType;
}

export interface CollectorWorker {
  canCollect: (options: CollectOptions) => boolean;
  collect: (options: CollectOptions) => Promise<CollectorItem>;
}
