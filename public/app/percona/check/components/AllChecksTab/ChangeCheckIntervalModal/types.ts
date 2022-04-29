import { Interval, CheckDetails } from 'app/percona/check/types';

export interface ChangeCheckIntervalModalProps {
  check: CheckDetails;
  onClose: () => void;
  onIntervalChanged: (check: CheckDetails) => void;
}

export interface ChangeCheckIntervalFormValues {
  interval?: keyof typeof Interval;
}
