import { TestPage } from '@grafana/toolkit/src/e2e';

export interface DataSourcesPage {}

export const dataSourcesPage = new TestPage<DataSourcesPage>({
  url: '/datasources',
  pageObjects: {},
});
