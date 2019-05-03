import { UserState } from 'app/types';
import { parseTimeZone } from '@grafana/ui';

export const getTimeZone = (state: UserState) => parseTimeZone(state.timeZone);
