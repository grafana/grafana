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
  { value: Interval.ADVISOR_CHECK_INTERVAL_FREQUENT, label: Interval.ADVISOR_CHECK_INTERVAL_FREQUENT },
  { value: Interval.ADVISOR_CHECK_INTERVAL_STANDARD, label: Interval.ADVISOR_CHECK_INTERVAL_STANDARD },
  { value: Interval.ADVISOR_CHECK_INTERVAL_RARE, label: Interval.ADVISOR_CHECK_INTERVAL_RARE },
  { value: Interval.ADVISOR_CHECK_INTERVAL_UNSPECIFIED, label: Interval.ADVISOR_CHECK_INTERVAL_UNSPECIFIED },
];
