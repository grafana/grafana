import { useState } from 'react';
import { type Action } from 'redux';

import { type DataSourcePluginMeta, PluginType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, FilterInput } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PluginsErrorsInfo } from 'app/features/plugins/components/PluginsErrorsInfo';
import { type DataSourcePluginCategory } from 'app/types/datasources';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { ROUTES } from '../../connections/constants';
import { DataSourceCategories } from '../components/DataSourceCategories';
import { DataSourceTypeCardList } from '../components/DataSourceTypeCardList';
import { useAddDatasource, useLoadDataSourcePlugins } from '../state/hooks';
import { setDataSourceTypeSearchQuery } from '../state/reducers';
import { getFilteredDataSourcePlugins } from '../state/selectors';

export function NewDataSource() {
  useLoadDataSourcePlugins();

  const dispatch = useDispatch();
  const filteredDataSources = useSelector((s: StoreState) => getFilteredDataSourcePlugins(s.dataSources));
  const searchQuery = useSelector((s: StoreState) => s.dataSources.dataSourceTypeSearchQuery);
  const isLoadingDatasourcePlugins = useSelector((s: StoreState) => s.dataSources.isLoadingDataSourcePlugins);
  const dataSourceCategories = useSelector((s: StoreState) => s.dataSources.categories);
  const onAddDataSource = useAddDatasource();
  const [addingDataSourceId, setAddingDataSourceId] = useState<string>();
  const onSetSearchQuery = (q: string) => dispatch(setDataSourceTypeSearchQuery(q));
  const onAddDataSourceClick = async (dataSource: DataSourcePluginMeta) => {
    if (addingDataSourceId) {
      return;
    }

    setAddingDataSourceId(dataSource.id);

    try {
      await onAddDataSource(dataSource);
    } catch {
      setAddingDataSourceId(undefined);
    }
  };

  return (
    <NewDataSourceView
      dataSources={filteredDataSources}
      dataSourceCategories={dataSourceCategories}
      searchQuery={searchQuery}
      isLoading={isLoadingDatasourcePlugins}
      addingDataSourceId={addingDataSourceId}
      onAddDataSource={onAddDataSourceClick}
      onSetSearchQuery={onSetSearchQuery}
    />
  );
}

export type ViewProps = {
  dataSources: DataSourcePluginMeta[];
  dataSourceCategories: DataSourcePluginCategory[];
  searchQuery: string;
  isLoading: boolean;
  addingDataSourceId?: string;
  onAddDataSource: (dataSource: DataSourcePluginMeta) => Promise<void>;
  onSetSearchQuery: (q: string) => Action;
};

export function NewDataSourceView({
  dataSources,
  dataSourceCategories,
  searchQuery,
  isLoading,
  addingDataSourceId,
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
        <FilterInput
          value={searchQuery}
          onChange={onSetSearchQuery}
          placeholder={t(
            'datasources.new-data-source-view.placeholder-filter-by-name-or-type',
            'Filter by name or type'
          )}
        />
        <div className="page-action-bar__spacer" />
        <LinkButton href={ROUTES.DataSources} fill="outline" variant="secondary" icon="arrow-left">
          <Trans i18nKey="datasources.new-data-source-view.cancel">Cancel</Trans>
        </LinkButton>
      </div>

      {/* Show datasource plugin errors while not searching for anything specific */}
      {!searchQuery && <PluginsErrorsInfo filterByPluginType={PluginType.datasource} />}

      {/* Search results */}
      <div>
        {searchQuery && (
          <DataSourceTypeCardList
            dataSourcePlugins={dataSources}
            addingDataSourceId={addingDataSourceId}
            onClickDataSourceType={onAddDataSource}
          />
        )}
        {!searchQuery && (
          <DataSourceCategories
            categories={dataSourceCategories}
            addingDataSourceId={addingDataSourceId}
            onClickDataSourceType={onAddDataSource}
          />
        )}
      </div>
    </>
  );
}
