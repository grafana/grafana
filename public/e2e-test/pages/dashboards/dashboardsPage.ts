import { TestPage, ClickablePageObjectType, ClickablePageObject, Selector } from '@grafana/toolkit';

export interface DashboardsPage {
  dashboard: ClickablePageObjectType;
}

export const dashboardsPageFactory = (dashboardTitle: string) =>
  new TestPage<DashboardsPage>({
    url: '/dashboards',
    pageObjects: {
      dashboard: new ClickablePageObject(Selector.fromAriaLabel(dashboardTitle)),
    },
  });
