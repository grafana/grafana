import { setTimeRange, type TimeRangeConfig } from './setTimeRange';

export type { TimeRangeConfig };

export const setDashboardTimeRange = (config: TimeRangeConfig) => setTimeRange(config);
