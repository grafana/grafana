import { ClickablePageObjectType } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface DashboardsPage {
  dashboard: ClickablePageObjectType;
}

export const dashboardsPageFactory = (dashboardTitle: string) =>
  new TestPage<DashboardsPage>({
    url: '/dashboards',
    pageObjects: {
      dashboard: dashboardTitle,
    },
  });
