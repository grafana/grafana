import { Interval, CheckDetails } from 'app/percona/check/types';

export interface ChangeCheckIntervalModalProps {
  check: CheckDetails;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
}

export interface ChangeCheckIntervalFormValues {
  interval?: keyof typeof Interval;
}
