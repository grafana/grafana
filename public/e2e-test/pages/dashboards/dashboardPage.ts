import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface DashboardPage {
  settings: ClickablePageObjectType;
}

export const dashboardPage = new TestPage<DashboardPage>({
  pageObjects: {
    settings: 'Dashboard settings navbar button',
  },
});
