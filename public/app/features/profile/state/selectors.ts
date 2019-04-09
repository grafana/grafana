import { UserState } from 'app/types';
import { TimeZone } from '@grafana/ui';

export const getTimeZone = (state: UserState) => {
  return {
    raw: state.timeZone,
    isUtc: state.timeZone === 'utc',
  } as TimeZone;
};
