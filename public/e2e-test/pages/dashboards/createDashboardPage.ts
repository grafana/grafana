import { ClickablePageObjectType, ClickablePageObject, Selector } from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface CreateDashboardPage {
  addQuery: ClickablePageObjectType;
}

export const createDashboardPage = new TestPage<CreateDashboardPage>({
  url: '/dashboard/new',
  pageObjects: {
    addQuery: new ClickablePageObject(Selector.fromAriaLabel('Add Query CTA button')),
  },
});
