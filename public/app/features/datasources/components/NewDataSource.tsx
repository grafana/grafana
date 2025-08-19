import { Action } from 'redux';

import { DataSourcePluginMeta, PluginType } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LinkButton, FilterInput } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PluginsErrorsInfo } from 'app/features/plugins/components/PluginsErrorsInfo';
import { DataSourcePluginCategory } from 'app/types/datasources';
import { StoreState, useDispatch, useSelector } from 'app/types/store';

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
          <DataSourceTypeCardList dataSourcePlugins={dataSources} onClickDataSourceType={onAddDataSource} />
        )}
        {!searchQuery && (
          <DataSourceCategories categories={dataSourceCategories} onClickDataSourceType={onAddDataSource} />
        )}
      </div>
    </>
  );
}
