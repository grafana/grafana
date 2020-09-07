import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';
import { setDashboardTimeRange, TimeRangeConfig } from './setDashboardTimeRange';

interface OpenDashboardDefault {
  uid: string;
}

interface OpenDashboardOptional {
  timeRange?: TimeRangeConfig;
}

export type PartialOpenDashboardConfig = Partial<OpenDashboardDefault> & OpenDashboardOptional;
export type OpenDashboardConfig = OpenDashboardDefault & OpenDashboardOptional;

// @todo this actually returns type `Cypress.Chainable<OpenDashboardConfig>`
export const openDashboard = (config?: PartialOpenDashboardConfig) =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig: OpenDashboardConfig = {
      uid: lastAddedDashboardUid,
      ...config,
    };

    const { timeRange, uid } = fullConfig;

    e2e.pages.Dashboard.visit(uid);

    if (timeRange) {
      setDashboardTimeRange(timeRange);
    }

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig }, { log: false });
  });
