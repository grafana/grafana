import { e2e } from '../index';

export interface DashboardTimeRangeConfig {
  from: string;
  to: string;
}

export const setDashboardTimeRange = ({ from, to }: DashboardTimeRangeConfig) =>
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
      .type(from);
    e2e()
      .get('[aria-label="TimePicker to field"]')
      .clear()
      .type(to);
    e2e()
      .get('[aria-label="TimePicker submit button"]')
      .click();
  });
