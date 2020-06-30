import { DashboardTimeRangeConfig, setDashboardTimeRange } from './setDashboardTimeRange';
import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

export interface OpenDashboardConfig {
  timeRange?: DashboardTimeRangeConfig;
  uid: string;
}

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
    return e2e().wrap({ config: fullConfig });
  });
