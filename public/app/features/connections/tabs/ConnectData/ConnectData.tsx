import { css } from '@emotion/css';
import { useMemo, useState, MouseEvent } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PluginType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationSearchToObject, reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, EmptyState, Field, RadioButtonGroup, Tooltip, Combobox, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { contextSrv } from 'app/core/services/context_srv';
import { useLoadDataSourcePlugins } from 'app/features/datasources/state/hooks';
import { HorizontalGroup } from 'app/features/plugins/admin/components/HorizontalGroup';
import { SearchField } from 'app/features/plugins/admin/components/SearchField';
import { Sorters } from 'app/features/plugins/admin/helpers';
import { useHistory } from 'app/features/plugins/admin/hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector, StoreState } from 'app/types/store';

import { ROUTES } from '../../constants';

import { CardGrid, type CardGridItem } from './CardGrid/CardGrid';
import { CategoryHeader } from './CategoryHeader/CategoryHeader';
import { NoAccessModal } from './NoAccessModal/NoAccessModal';

const getStyles = (theme: GrafanaTheme2) => ({
  searchContainer: css({
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(1),
    marginBottom: theme.spacing(3),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  contentWrap: css({
    height: 'calc(100vh - 350px)',
    overflowY: 'auto',
  }),
  spacer: css({
    height: theme.spacing(2),
  }),
  modal: css({
    width: '500px',
  }),
  modalContent: css({
    overflow: 'visible',
  }),
  actionBar: css({
    [theme.breakpoints.up('xl')]: {
      marginLeft: 'auto',
    },
  }),
});

export function AddNewConnection() {
  useLoadDataSourcePlugins();

  const [queryParams, setQueryParams] = useQueryParams();
  const searchTerm = queryParams.search ? String(queryParams.search) : '';
  const [isNoAccessModalOpen, setIsNoAccessModalOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState<CardGridItem | null>(null);
  const location = useLocation();
  const history = useHistory();
  const locationSearch = locationSearchToObject(location.search);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const sortBy = (locationSearch.sortBy ?? Sorters.nameAsc) as Sorters;
  const filterBy = locationSearch.filterBy?.toString() || 'all';
  const categoryFilter = locationSearch.category?.toString() || 'all';
  const typeFilter = locationSearch.type?.toString() || 'all';
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const styles = useStyles2(getStyles);

  // Get categories from Redux state
  const dataSourceCategories = useSelector((s: StoreState) => s.dataSources.categories);

  const handleSearchChange = (val: string) => {
    setQueryParams({
      search: val,
    });
  };
  const remotePluginsAvailable = useIsRemotePluginsAvailable();

  const { error, plugins, isLoading } = useGetAll(
    {
      keyword: searchTerm,
      isInstalled: filterBy === 'installed' ? true : undefined,
      hasUpdate: filterBy === 'has-update' ? true : undefined,
    },
    sortBy
  );

  const filterByOptions = [
    { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All') },
    { value: 'installed', label: t('connections.add-new-connection.filter-by-options.label.installed', 'Installed') },
    {
      value: 'has-update',
      label: t('connections.add-new-connection.filter-by-options.label.new-updates', 'New Updates'),
    },
  ];

  const onClickCardGridItem = (e: MouseEvent<HTMLElement>, item: CardGridItem) => {
    if (!canCreateDataSources) {
      e.preventDefault();
      e.stopPropagation();
      openModal(item);
      reportInteraction('connections_plugin_card_clicked', {
        plugin_id: item.id,
        creator_team: 'grafana_plugins_catalog',
        schema_version: '1.0.0',
      });
    }
  };

  const openModal = (item: CardGridItem) => {
    setIsNoAccessModalOpen(true);
    setFocusedItem(item);
  };

  const closeModal = () => {
    setIsNoAccessModalOpen(false);
    setFocusedItem(null);
  };

  const getPluginsByType = useMemo(() => {
    return {
      [PluginType.datasource]: plugins.filter((plugin) => plugin.type === PluginType.datasource),
      [PluginType.app]: plugins.filter((plugin) => plugin.type === PluginType.app),
    };
  }, [plugins]);

  const dataSourcesPlugins = getPluginsByType[PluginType.datasource];
  const appsPlugins = getPluginsByType[PluginType.app];

  const datasourceCardGridItems = useMemo(() => {
    // Get all datasource plugins directly from categories in Redux state
    // This ensures they match and have proper category information
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPlugins: Record<string, any> = {};
    dataSourceCategories.forEach((category) => {
      category.plugins.forEach((plugin) => {
        allPlugins[plugin.id] = {
          ...plugin,
          logo: plugin.info.logos.small,
          url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
          category: category.id,
          // Add safe defaults for CatalogPlugin properties that don't exist on DataSourcePluginMeta
          isEnterprise: false,
          isDeprecated: false,
          isInstalled: false,
          isDisabled: false,
          isProvisioned: false,
          isCore: false,
          isPreinstalled: { withVersion: false },
          isManaged: false,
          hasUpdate: false,
        };
      });
    });

    // Convert to array and filter by categoryFilter and typeFilter
    return Object.values(allPlugins).filter((plugin) => {
      const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
      const matchesType = typeFilter === 'all' || plugin.type === typeFilter;
      return matchesCategory && matchesType;
    });
  }, [dataSourceCategories, categoryFilter, typeFilter]);

  const categoryOptions = useMemo(() => {
    // Use categories from Redux state instead of building them
    return [
      { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All categories') },
      ...dataSourceCategories.map((category) => ({
        value: category.id,
        label: category.title,
      })),
    ];
  }, [dataSourceCategories]);

  const typeOptions = [
    { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All types') },
    { value: 'datasource', label: t('connections.add-new-connection.label.datasources', 'Data Sources') },
    { value: 'app', label: t('connections.add-new-connection.label.apps', 'Apps') },
  ];

  const appsCardGridItems = useMemo(
    () =>
      appsPlugins.map((plugin) => ({
        ...plugin,
        logo: plugin.info.logos.small,
        url: `/plugins/${plugin.id}`,
      })),
    [appsPlugins]
  );

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: string) => {
    history.push({ query: { filterBy: value } });
  };

  const onCategoryFilterChange = (option: { value?: string } | null) => {
    history.push({ query: { category: option?.value || 'all' } });
  };

  const onTypeFilterChange = (value: string) => {
    history.push({ query: { type: value } });
  };

  const showNoResults = useMemo(
    () => !isLoading && !error && dataSourcesPlugins.length < 1 && appsPlugins.length < 1,
    [isLoading, error, dataSourcesPlugins, appsPlugins]
  );

  return (
    <>
      {focusedItem && <NoAccessModal item={focusedItem} isOpen={isNoAccessModalOpen} onDismiss={closeModal} />}

      <div className={styles.searchContainer}>
        <HorizontalGroup wrap>
          <Field label={t('common.search', 'Search')} noMargin>
            <SearchField value={searchTerm} onSearch={handleSearchChange} />
          </Field>
          <HorizontalGroup className={styles.actionBar}>
            {/* Filter by installed / all */}
            {remotePluginsAvailable ? (
              <Field label={t('plugins.filter.state', 'State')} noMargin>
                <RadioButtonGroup value={filterBy} onChange={onFilterByChange} options={filterByOptions} />
              </Field>
            ) : (
              <Tooltip
                content={t(
                  'plugins.filter.disabled',
                  'This filter has been disabled because the Grafana server cannot access grafana.com'
                )}
                placement="top"
              >
                <div>
                  <Field label={t('plugins.filter.state', 'State')} noMargin>
                    <RadioButtonGroup
                      disabled={true}
                      value={filterBy}
                      onChange={onFilterByChange}
                      options={filterByOptions}
                    />
                  </Field>
                </div>
              </Tooltip>
            )}

            {/* Sorting */}
            <Field label={t('plugins.filter.sort', 'Sort')} noMargin>
              <Combobox
                aria-label={t('plugins.filter.sort-list', 'Sort Plugins List')}
                width={24}
                value={sortBy?.toString()}
                onChange={onSortByChange}
                options={[
                  { value: 'nameAsc', label: t('connections.add-new-connection.label.by-name-az', 'By name (A-Z)') },
                  { value: 'nameDesc', label: t('connections.add-new-connection.label.by-name-za', 'By name (Z-A)') },
                  {
                    value: 'updated',
                    label: t('connections.add-new-connection.label.by-updated-date', 'By updated date'),
                  },
                  {
                    value: 'published',
                    label: t('connections.add-new-connection.label.by-published-date', 'By published date'),
                  },
                  {
                    value: 'downloads',
                    label: t('connections.add-new-connection.label.by-downloads', 'By downloads'),
                  },
                ]}
              />
            </Field>

            {/* Category Filter */}
            {dataSourcesPlugins.length > 0 && (
              <Field label={t('connections.add-new-connection.label.category', 'Category')} noMargin>
                <Combobox
                  aria-label={t('connections.add-new-connection.label.filter-by-category', 'Filter by Category')}
                  width={24}
                  value={categoryFilter}
                  onChange={onCategoryFilterChange}
                  options={categoryOptions}
                />
              </Field>
            )}

            {/* Type Filter */}
            <Field label={t('connections.add-new-connection.label.type', 'Type')} noMargin>
              <RadioButtonGroup value={typeFilter} onChange={onTypeFilterChange} options={typeOptions} />
            </Field>
          </HorizontalGroup>
        </HorizontalGroup>
      </div>
      <div className={styles.contentWrap}>
        {isLoading ? (
          <LoadingPlaceholder text={t('common.loading', 'Loading...')} />
        ) : !!error ? (
          <Trans i18nKey="alerting.policies.update-errors.error-code" values={{ error: error.message }}>
            Error message: &quot;{{ error: error.message }}&quot;
          </Trans>
        ) : (
          <>
            {/* Data Sources Section */}
            {typeFilter !== 'app' && datasourceCardGridItems.length > 0 && (
              <>
                <CategoryHeader
                  iconName="database"
                  label={t('connections.connect-data.datasources-header', 'Data Sources')}
                />
                <CardGrid items={datasourceCardGridItems} onClickItem={onClickCardGridItem} />
              </>
            )}

            {/* Apps Section */}
            {typeFilter !== 'datasource' && appsPlugins.length > 0 && (
              <>
                <div className={styles.spacer} />
                <CategoryHeader iconName="apps" label={t('connections.connect-data.apps-header', 'Apps')} />
                <CardGrid items={appsCardGridItems} onClickItem={onClickCardGridItem} />
              </>
            )}
          </>
        )}

        {showNoResults && (
          <EmptyState
            variant="not-found"
            message={t('connections.connect-data.empty-message', 'No results matching your query were found')}
          />
        )}
      </div>
    </>
  );
}
