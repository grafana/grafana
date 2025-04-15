import { GrafanaTheme2, TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

export interface FacettableValue {
  name: string;
  selected?: boolean;
  details?: string;
}

export interface SelectableLabel {
  name: string;
  selected?: boolean;
  loading?: boolean;
  values?: FacettableValue[];
  hidden?: boolean;
  facets?: number;
}

export interface BrowserProps {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
  theme: GrafanaTheme2;
  autoSelect?: number;
  hide?: () => void;
  timeRange?: TimeRange;
}

export interface BrowserState {
  labels: SelectableLabel[];
  labelSearchTerm: string;
  metricSearchTerm: string;
  status: string;
  error: string;
  validationStatus: string;
  valueSearchTerm: string;
  seriesLimit?: string;
}

export const DEFAULT_SERIES_LIMIT = '40000';
export const REMOVE_SERIES_LIMIT = 'none';
export const EMPTY_SELECTOR = '{}';
export const METRIC_LABEL = '__name__';
export const LIST_ITEM_SIZE = 25;
export const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';
