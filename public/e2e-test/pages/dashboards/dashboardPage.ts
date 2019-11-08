import { ClickablePageObject, ClickablePageObjectType, Selector, TestPage } from '@grafana/toolkit/src/e2e';

export interface DashboardPage {
  settings: ClickablePageObjectType;
}

export const dashboardPage = new TestPage<DashboardPage>({
  pageObjects: {
    settings: new ClickablePageObject(Selector.fromAriaLabel('Dashboard settings navbar button')),
  },
});
