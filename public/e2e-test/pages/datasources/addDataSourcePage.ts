import { TestPage, ClickablePageObject, Selector, ClickablePageObjectType } from '@grafana/toolkit';

export interface AddDataSourcePage {
  testDataDB: ClickablePageObjectType;
}

export const addDataSourcePage = new TestPage<AddDataSourcePage>({
  url: '/datasources/new',
  pageObjects: {
    testDataDB: new ClickablePageObject(Selector.fromAriaLabel('TestData DB datasource plugin')),
  },
});
