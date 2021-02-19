import { pageFactory } from '../support';

export const AddDataSource = pageFactory({
  url: '/datasources/new',
  selectors: {
    dataSourcePlugins: (pluginName: string) => `Data source plugin item ${pluginName}`,
  },
});
