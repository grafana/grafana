import { TestPage, ClickablePageObject, Selector, ClickablePageObjectType } from '@grafana/toolkit/src/e2e';

export interface AddDataSourcePage {
  testDataDB: ClickablePageObjectType;
}

export const addDataSourcePage = new TestPage<AddDataSourcePage>({
  url: '/datasources/new',
  pageObjects: {
    testDataDB: new ClickablePageObject(Selector.fromAriaLabel('TestData DB datasource plugin')),
  },
});
