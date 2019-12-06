import { pageFactory } from '../support';

export const DataSources = pageFactory({
  url: '/datasources',
  selectors: {
    dataSources: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
    addDataSource: () => '.page-action-bar > .btn',
  },
});
