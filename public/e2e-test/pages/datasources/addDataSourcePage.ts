import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface AddDataSourcePage {
  testDataDB: ClickablePageObjectType;
}

export const addDataSourcePage = new TestPage<AddDataSourcePage>({
  url: '/datasources/new',
  pageObjects: {
    testDataDB: 'TestData DB datasource plugin',
  },
});
