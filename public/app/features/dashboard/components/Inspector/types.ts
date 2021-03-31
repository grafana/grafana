export interface Sanitizer {
  id: string;
  canSanitize: (item: CollectorItem) => boolean;
  sanitize: (item: CollectorItem) => Record<string, any>;
}

export interface CollectorItem {
  id: string;
  name: string;
  data: Record<string, any>;
}

export enum CollectorWorkers {
  os = 'OSCollectorWorker',
  browser = 'BrowserCollectorWorker',
  grafana = 'GrafanaCollectorWorker',
  dashboard = 'DashboardJsonCollectorWorker',
  panelJson = 'PanelJsonCollectorWorker',
  panelData = 'PanelDataCollectorWorker',
}
