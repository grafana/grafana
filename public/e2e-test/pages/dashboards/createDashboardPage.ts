import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface CreateDashboardPage {
  addQuery: ClickablePageObjectType;
}

export const createDashboardPage = new TestPage<CreateDashboardPage>({
  url: '/dashboard/new',
  pageObjects: {
    addQuery: 'Add Query CTA button',
  },
});
