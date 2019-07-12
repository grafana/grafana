import { ClickablePageObjectType, ClickablePageObject, Selector } from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

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
