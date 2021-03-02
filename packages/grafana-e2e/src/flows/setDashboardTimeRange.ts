import { e2e } from '../index';
import { setTimeRange, TimeRangeConfig } from './setTimeRange';

export { TimeRangeConfig };

export const setDashboardTimeRange = (config: TimeRangeConfig) =>
  e2e.components.PageToolbar.container().within(() => setTimeRange(config));
