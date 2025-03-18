import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

import { setDashboardTimeRange, TimeRangeConfig } from './setDashboardTimeRange';

interface OpenDashboardDefault {
  uid: string;
}

interface OpenDashboardOptional {
  timeRange?: TimeRangeConfig;
  queryParams?: object;
}

export type PartialOpenDashboardConfig = Partial<OpenDashboardDefault> & OpenDashboardOptional;
export type OpenDashboardConfig = OpenDashboardDefault & OpenDashboardOptional;

export const openDashboard = (config?: PartialOpenDashboardConfig) =>
  getScenarioContext().then(({ lastAddedDashboardUid }) => {
    const fullConfig: OpenDashboardConfig = {
      uid: lastAddedDashboardUid,
      ...config,
    };

    const { timeRange, uid, queryParams } = fullConfig;

    e2e.pages.Dashboard.visit(uid, queryParams);

    if (timeRange) {
      setDashboardTimeRange(timeRange);
    }

    // @todo remove `wrap` when possible
    return cy.wrap({ config: fullConfig }, { log: false });
  });
