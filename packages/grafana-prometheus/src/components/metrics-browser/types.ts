export interface Metric {
  name: string;
  details?: string;
}

export const DEFAULT_SERIES_LIMIT = '40000';
export const REMOVE_SERIES_LIMIT = 'none';
export const EMPTY_SELECTOR = '{}';
export const METRIC_LABEL = '__name__';
export const LIST_ITEM_SIZE = 25;
export const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';
