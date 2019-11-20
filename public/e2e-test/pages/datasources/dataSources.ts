import { ClickablePageObject, ClickablePageObjectType, Selector, TestPage } from '@grafana/toolkit/src/e2e';

export interface DataSourcesPage {
  testData: ClickablePageObjectType;
}

export const dataSourcesPageFactory = (testDataSourceName: string) =>
  new TestPage<DataSourcesPage>({
    url: '/datasources',
    pageObjects: {
      testData: new ClickablePageObject(Selector.fromAriaLabel(`Data source list item for ${testDataSourceName}`)),
    },
  });
