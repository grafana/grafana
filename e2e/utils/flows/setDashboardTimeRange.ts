import { setTimeRange, TimeRangeConfig } from './setTimeRange';

export type { TimeRangeConfig };

export const setDashboardTimeRange = (config: TimeRangeConfig) => setTimeRange(config);
