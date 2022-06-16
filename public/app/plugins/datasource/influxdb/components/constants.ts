import { SelectableValue } from '@grafana/data';

import { ResultFormat } from '../types';

export const RESULT_FORMATS: Array<SelectableValue<ResultFormat>> = [
  { label: 'Time series', value: 'time_series' },
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
];

export const DEFAULT_RESULT_FORMAT: ResultFormat = 'time_series';
