import { TestPage } from 'e2e-test/core/pages';

export interface DataSourcesPage {}

export const dataSourcesPage = new TestPage<DataSourcesPage>({
  url: '/datasources',
});
