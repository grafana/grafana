import React from 'react';
import { AnyAction } from 'redux';

import { DataSourcePluginMeta } from '@grafana/data';
import { LinkButton, FilterInput } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PluginsErrorsInfo } from 'app/features/plugins/components/PluginsErrorsInfo';
import { DataSourcePluginCategory, StoreState, useDispatch, useSelector } from 'app/types';

import { DataSourceCategories } from '../components/DataSourceCategories';
import { DataSourceTypeCardList } from '../components/DataSourceTypeCardList';
import {
  useAddDatasource,
  useLoadDataSourcePlugins,
  getFilteredDataSourcePlugins,
  setDataSourceTypeSearchQuery,
  useDataSourcesRoutes,
} from '../state';

export function NewDataSource() {
  useLoadDataSourcePlugins();

  const dispatch = useDispatch();
  const filteredDataSources = useSelector((s: StoreState) => getFilteredDataSourcePlugins(s.dataSources));
  const searchQuery = useSelector((s: StoreState) => s.dataSources.dataSourceTypeSearchQuery);
  const isLoading = useSelector((s: StoreState) => s.dataSources.isLoadingDataSources);
  const dataSourceCategories = useSelector((s: StoreState) => s.dataSources.categories);
  const onAddDataSource = useAddDatasource();
  const onSetSearchQuery = (q: string) => dispatch(setDataSourceTypeSearchQuery(q));

  return (
    <NewDataSourceView
      dataSources={filteredDataSources}
      dataSourceCategories={dataSourceCategories}
      searchQuery={searchQuery}
      isLoading={isLoading}
      onAddDataSource={onAddDataSource}
      onSetSearchQuery={onSetSearchQuery}
    />
  );
}

export type ViewProps = {
  dataSources: DataSourcePluginMeta[];
  dataSourceCategories: DataSourcePluginCategory[];
  searchQuery: string;
  isLoading: boolean;
  onAddDataSource: (dataSource: DataSourcePluginMeta) => void;
  onSetSearchQuery: (q: string) => AnyAction;
};

export function NewDataSourceView({
  dataSources,
  dataSourceCategories,
  searchQuery,
  isLoading,
  onAddDataSource,
  onSetSearchQuery,
}: ViewProps) {
  const dataSourcesRoutes = useDataSourcesRoutes();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <>
      {/* Search */}
      <div className="page-action-bar">
        <FilterInput value={searchQuery} onChange={onSetSearchQuery} placeholder="Filter by name or type" />
        <div className="page-action-bar__spacer" />
        <LinkButton href={dataSourcesRoutes.List} fill="outline" variant="secondary" icon="arrow-left">
          Cancel
        </LinkButton>
      </div>

      {/* Show any plugin errors while not searching for anything specific */}
      {!searchQuery && <PluginsErrorsInfo />}

      {/* Search results */}
      <div>
        {searchQuery && (
          <DataSourceTypeCardList dataSourcePlugins={dataSources} onClickDataSourceType={onAddDataSource} />
        )}
        {!searchQuery && (
          <DataSourceCategories categories={dataSourceCategories} onClickDataSourceType={onAddDataSource} />
        )}
      </div>
    </>
  );
}
