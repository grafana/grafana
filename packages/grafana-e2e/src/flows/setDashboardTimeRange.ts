import { e2e } from '../index';
import { setTimeRange, TimeRangeConfig } from './setTimeRange';

export { TimeRangeConfig };

export const setDashboardTimeRange = (config: TimeRangeConfig) =>
  e2e.pages.Dashboard.Toolbar.navBar().within(() => setTimeRange(config));
