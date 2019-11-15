import { ClickablePageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface DataSourcesPage {
  testData: ClickablePageObjectType;
}

export const dataSourcesPageFactory = (testDataSourceName: string) =>
  new TestPage<DataSourcesPage>({
    url: '/datasources',
    pageObjects: {
      testData: `Data source list item for ${testDataSourceName}`,
    },
  });
