import { TestPage } from '@grafana/toolkit';

export interface DataSourcesPage {}

export const dataSourcesPage = new TestPage<DataSourcesPage>({
  url: '/datasources',
  pageObjects: {},
});
