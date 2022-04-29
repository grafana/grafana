import { SelectableValue } from '@grafana/data';
import { Interval } from '../../types';

export const GET_ALL_CHECKS_CANCEL_TOKEN = 'getAllChecks';

export const STATUS_OPTIONS: Array<SelectableValue<string>> = [
  { value: 'all', label: 'All' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
];
export const INTERVAL_OPTIONS: Array<SelectableValue<Interval | string>> = [
  { value: 'all', label: 'All' },
  { value: Interval.FREQUENT, label: Interval.FREQUENT },
  { value: Interval.STANDARD, label: Interval.STANDARD },
  { value: Interval.RARE, label: Interval.RARE },
];
