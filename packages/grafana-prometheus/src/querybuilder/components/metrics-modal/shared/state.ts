import { SelectableValue } from '@grafana/data';

import { MetricsData } from '../types';

export interface MetricsModalStateModel {
  isLoading: boolean;
  metrics: MetricsData;
  hasMetadata: boolean;
  selectedTypes: Array<SelectableValue<string>>;
}

export const initialState = (query: unknown): MetricsModalStateModel => ({
  isLoading: true,
  metrics: [],
  hasMetadata: false,
  selectedTypes: [],
});
