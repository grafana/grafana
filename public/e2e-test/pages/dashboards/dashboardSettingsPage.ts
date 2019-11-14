import { ClickablePageObject, ClickablePageObjectType, Selector, TestPage } from '@grafana/toolkit/src/e2e';

export interface DashboardSettingsPage {
  deleteDashBoard: ClickablePageObjectType;
  variablesSection: ClickablePageObjectType;
}

export const dashboardSettingsPage = new TestPage<DashboardSettingsPage>({
  pageObjects: {
    deleteDashBoard: new ClickablePageObject(Selector.fromAriaLabel('Dashboard settings page delete dashboard button')),
    variablesSection: new ClickablePageObject(Selector.fromAriaLabel('Dashboard settings section Variables')),
  },
});
