import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';
import { setDashboardTimeRange, TimeRangeConfig } from './setDashboardTimeRange';

export interface OpenDashboardConfig {
  timeRange?: TimeRangeConfig;
  uid: string;
}

// @todo improve config input/output: https://stackoverflow.com/a/63507459/923745
export const openDashboard = (config?: Partial<OpenDashboardConfig>) =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig = {
      uid: lastAddedDashboardUid,
      ...config,
    } as OpenDashboardConfig;

    const { timeRange, uid } = fullConfig;

    e2e.pages.Dashboard.visit(uid);

    if (timeRange) {
      setDashboardTimeRange(timeRange);
    }

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig }, { log: false });
  });
