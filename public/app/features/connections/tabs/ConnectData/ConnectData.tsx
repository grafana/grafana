import { css } from '@emotion/css';
import { useMemo, useState, MouseEvent } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PluginType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationSearchToObject, reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, EmptyState, Field, RadioButtonGroup, Tooltip, Combobox, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { contextSrv } from 'app/core/services/context_srv';
import { HorizontalGroup } from 'app/features/plugins/admin/components/HorizontalGroup';
import { SearchField } from 'app/features/plugins/admin/components/SearchField';
import { Sorters } from 'app/features/plugins/admin/helpers';
import { useHistory } from 'app/features/plugins/admin/hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types/accessControl';

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
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const styles = useStyles2(getStyles);

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

  console.log('appsPlugins', appsPlugins);
  const datasourceCardGridItems = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPlugins: Record<string, any> = {};

    // Add remote/available datasources from useGetAll
    dataSourcesPlugins.forEach((plugin) => {
      allPlugins[plugin.id] = {
        ...plugin,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
        category: plugin.category || 'other',
      };
    });

    // Convert to array and filter by categoryFilter
    return Object.values(allPlugins).filter((plugin) => {
      const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
      return matchesCategory;
    });
  }, [dataSourcesPlugins, categoryFilter]);

  const categoryOptions = useMemo(() => {
    // Predefined categories with nice labels (matching buildCategories.ts)
    const predefinedCategories: Record<string, string> = {
      tsdb: t('datasources.build-categories.categories.title.time-series-databases', 'Time series databases'),
      logging: t('datasources.build-categories.categories.title.logging-document-databases', 'Logging & document databases'),
      tracing: t('datasources.build-categories.categories.title.distributed-tracing', 'Distributed tracing'),
      profiling: t('datasources.build-categories.categories.title.profiling', 'Profiling'),
      sql: t('datasources.build-categories.categories.title.sql', 'SQL'),
      cloud: t('datasources.build-categories.categories.title.cloud', 'Cloud'),
      enterprise: t('datasources.build-categories.categories.title.enterprise-plugins', 'Enterprise plugins'),
      iot: t('datasources.build-categories.categories.title.industrial-io-t', 'Industrial & IoT'),
      other: t('datasources.build-categories.categories.title.others', 'Others'),
    };

    // Collect categories from plugins that aren't in predefined list
    const customCategories = new Set<string>();
    
    dataSourcesPlugins.forEach((plugin) => {
      if (plugin.category && !predefinedCategories[plugin.category]) {
        customCategories.add(plugin.category);
      }
    });
    
    appsPlugins.forEach((plugin) => {
      if (plugin.category && !predefinedCategories[plugin.category]) {
        customCategories.add(plugin.category);
      }
    });

    // Build options: predefined first, then custom
    return [
      { value: 'all', label: t('connections.add-new-connection.filter-by-options.label.all', 'All categories') },
      ...Object.entries(predefinedCategories)
        .map(([id, label]) => ({
          value: id,
          label,
        })),
      ...Array.from(customCategories)
        .sort()
        .map((category) => ({
          value: category,
          label: category.charAt(0).toUpperCase() + category.slice(1),
        })),
    ];
  }, [dataSourcesPlugins, appsPlugins]);

  const appsCardGridItems = useMemo(
    () =>
      appsPlugins
        .map((plugin) => ({
          ...plugin,
          logo: plugin.info.logos.small,
          url: `/plugins/${plugin.id}`,
          category: plugin.category || 'other',
        }))
        .filter((plugin) => {
          const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
          return matchesCategory;
        }),
    [appsPlugins, categoryFilter]
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
            {datasourceCardGridItems.length > 0 && (
              <>
                <CategoryHeader
                  iconName="database"
                  label={t('connections.connect-data.datasources-header', 'Data Sources')}
                />
                <CardGrid items={datasourceCardGridItems} onClickItem={onClickCardGridItem} />
              </>
            )}

            {appsCardGridItems.length > 0 && (
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
