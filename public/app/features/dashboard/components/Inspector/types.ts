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
