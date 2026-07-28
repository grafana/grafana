import memoizeOne from 'memoize-one';

import { type DataSourcePluginMeta, type DataSourceSettings, type UrlQueryValue } from '@grafana/data';
import { type DataSourcesState } from 'app/types/datasources';

// Use consistent references for empty objects to prevent infinite re-renders
const EMPTY_DATASOURCE = {} as DataSourceSettings;
const EMPTY_DATASOURCE_META = {} as DataSourcePluginMeta;

const collator = new Intl.Collator();

export const getDataSources = memoizeOne((state: DataSourcesState) => {
  const regex = new RegExp(state.searchQuery, 'i');

  const filteredDataSources = state.dataSources.filter((dataSource: DataSourceSettings) => {
    return regex.test(dataSource.name) || regex.test(dataSource.database) || regex.test(dataSource.type);
  });

  return filteredDataSources.sort((a, b) =>
    state.isSortAscending ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name)
  );
});

export const getFilteredDataSourcePlugins = memoizeOne((state: DataSourcesState) => {
  const regex = new RegExp(state.dataSourceTypeSearchQuery, 'i');

  return state.plugins.filter((type: DataSourcePluginMeta) => {
    return regex.test(type.name);
  });
});

export const getDataSource = (state: DataSourcesState, dataSourceId: UrlQueryValue): DataSourceSettings => {
  if (state.dataSource.uid === dataSourceId) {
    return state.dataSource;
  }
  return EMPTY_DATASOURCE;
};

export const getDataSourceMeta = (state: DataSourcesState, type: string): DataSourcePluginMeta => {
  if (state.dataSourceMeta.id === type) {
    return state.dataSourceMeta;
  }

  return EMPTY_DATASOURCE_META;
};

export const getDataSourcesSearchQuery = (state: DataSourcesState) => state.searchQuery;
export const getDataSourcesCount = (state: DataSourcesState) => state.dataSourcesCount;
export const getDataSourcesSort = (state: DataSourcesState) => state.isSortAscending;
