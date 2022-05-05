import { setTimeRange, TimeRangeConfig } from './setTimeRange';

export { TimeRangeConfig };

export const setDashboardTimeRange = (config: TimeRangeConfig) => setTimeRange(config);
