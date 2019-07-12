import { ClickablePageObject, Selector, ClickablePageObjectType } from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface AddDataSourcePage {
  testDataDB: ClickablePageObjectType;
}

export const addDataSourcePage = new TestPage<AddDataSourcePage>({
  url: '/datasources/new',
  pageObjects: {
    testDataDB: new ClickablePageObject(Selector.fromAriaLabel('TestData DB datasource plugin')),
  },
});
