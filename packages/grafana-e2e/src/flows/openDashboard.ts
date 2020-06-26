import { e2e } from '../index';
import { getScenarioContext } from '../support/scenarioContext';

export interface OpenDashboardConfig {
  uid: string;
  timeRange: {
    from: string;
    to: string;
  };
}

export const openDashboard = (config?: Partial<OpenDashboardConfig>) =>
  getScenarioContext().then(({ lastAddedDashboardUid }: any) => {
    const fullConfig = {
      timeRange: {
        from: '2020-01-01 00:00:00',
        to: '2020-01-01 01:00:00',
      },
      uid: lastAddedDashboardUid,
      ...config,
    } as OpenDashboardConfig;

    const { timeRange, uid } = fullConfig;

    e2e.pages.Dashboard.visit(uid);

    e2e.pages.Dashboard.Toolbar.navBar().within(() => {
      e2e()
        .get('[aria-label="TimePicker Open Button"]')
        .click();
      e2e()
        .get('[aria-label="TimePicker absolute time range"]')
        .click();
      e2e()
        .get('[aria-label="TimePicker from field"]')
        .clear()
        .type(timeRange.from);
      e2e()
        .get('[aria-label="TimePicker to field"]')
        .clear()
        .type(timeRange.to);
      e2e()
        .get('[aria-label="TimePicker submit button"]')
        .click();
    });

    // @todo remove `wrap` when possible
    return e2e().wrap({ config: fullConfig });
  });
