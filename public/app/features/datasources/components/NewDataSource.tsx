import { Action } from 'redux';

import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { LinkButton, FilterInput } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PluginsErrorsInfo } from 'app/features/plugins/components/PluginsErrorsInfo';
import { DataSourcePluginCategory, StoreState, useDispatch, useSelector } from 'app/types';

import { ROUTES } from '../../connections/constants';
import { DataSourceCategories } from '../components/DataSourceCategories';
import { DataSourceTypeCardList } from '../components/DataSourceTypeCardList';
import {
  useAddDatasource,
  useLoadDataSourcePlugins,
  getFilteredDataSourcePlugins,
  setDataSourceTypeSearchQuery,
} from '../state';

export function NewDataSource() {
  useLoadDataSourcePlugins();

  const dispatch = useDispatch();
  const filteredDataSources = useSelector((s: StoreState) => getFilteredDataSourcePlugins(s.dataSources));
  const searchQuery = useSelector((s: StoreState) => s.dataSources.dataSourceTypeSearchQuery);
  const isLoadingDatasourcePlugins = useSelector((s: StoreState) => s.dataSources.isLoadingDataSourcePlugins);
  const dataSourceCategories = useSelector((s: StoreState) => s.dataSources.categories);
  const onAddDataSource = useAddDatasource();
  const onSetSearchQuery = (q: string) => dispatch(setDataSourceTypeSearchQuery(q));

  return (
    <NewDataSourceView
      dataSources={filteredDataSources}
      dataSourceCategories={dataSourceCategories}
      searchQuery={searchQuery}
      isLoading={isLoadingDatasourcePlugins}
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
  onSetSearchQuery: (q: string) => Action;
};

export function NewDataSourceView({
  dataSources,
  dataSourceCategories,
  searchQuery,
  isLoading,
  onAddDataSource,
  onSetSearchQuery,
}: ViewProps) {
  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <>
      {/* Search */}
      <div className="page-action-bar">
        <FilterInput value={searchQuery} onChange={onSetSearchQuery} placeholder="Filter by name or type" />
        <div className="page-action-bar__spacer" />
        <LinkButton href={ROUTES.DataSources} fill="outline" variant="secondary" icon="arrow-left">
          Cancel
        </LinkButton>
      </div>

      {/* Show datasource plugin errors while not searching for anything specific */}
      {!searchQuery && <PluginsErrorsInfo filterByPluginType={PluginType.datasource} />}

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
