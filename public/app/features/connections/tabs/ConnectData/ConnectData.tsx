import { css } from '@emotion/css';
import { useCallback, useMemo, useState, type MouseEvent } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import {
  LoadingPlaceholder,
  EmptyState,
  Field,
  IconButton,
  RadioButtonGroup,
  useStyles2,
  Sidebar,
  useSidebar,
  Stack,
} from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { contextSrv } from 'app/core/services/context_srv';
import { SearchField } from 'app/features/plugins/admin/components/SearchField';
import { useHistory } from 'app/features/plugins/admin/hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types/accessControl';

import type { CardGridItem } from './CardGrid/CardGrid';
import { FilterSidebar } from './FilterSidebar/FilterSidebar';
import { NoAccessModal } from './NoAccessModal/NoAccessModal';
import { PluginContentView } from './components/PluginContentView';
import { FILTER_BY_OPTIONS, GROUP_BY_OPTIONS, TYPE_FILTER_OPTIONS } from './constants';
import { useConnectionFiltersFromQuery } from './hooks/useConnectionFiltersFromQuery';
import { useCategoryFilterOptions, useFilteredPlugins, usePluginsByCategory } from './hooks/usePluginFiltering';

const getStyles = (theme: GrafanaTheme2) => ({
  searchHeader: css({
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  searchField: css({
    flex: 1,
  }),
  groupByControl: css({
    minWidth: '200px',
  }),
  contentWrap: css({
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing(2),
    minHeight: 0,
  }),
  mainContent: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  }),
  filterButtonWrapper: css({
    marginTop: theme.spacing(1),
    position: 'relative',
    width: '100%',
  }),
  activeFilterDot: css({
    position: 'absolute',
    top: theme.spacing(0.25),
    right: theme.spacing(0.75),
    width: theme.spacing(0.75),
    height: theme.spacing(0.75),
    borderRadius: theme.shape.radius.circle,
    backgroundColor: theme.colors.warning.text,
    opacity: 0.8,
    zIndex: 1,
    pointerEvents: 'none',
  }),
  outerWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  }),
});

export function AddNewConnection() {
  const [queryParams, setQueryParams] = useQueryParams();
  const searchTerm = queryParams.search ? String(queryParams.search) : '';
  const [selectedItem, setSelectedItem] = useState<CardGridItem | null>(null);
  const [isPaneOpen, setIsPaneOpen] = useState(false);
  const history = useHistory();
  const filterState = useConnectionFiltersFromQuery();
  const { sortBy, filterBy, groupBy, categoryFilter, typeFilter } = filterState;
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  const styles = useStyles2(getStyles);

  const updateFilter = useCallback(
    (params: Record<string, string>) => {
      history.push({ query: { ...filterState, ...params } });
    },
    [filterState, history]
  );
  const handlers = useMemo(
    () => ({
      onSortByChange: (v: { value?: string } | string) =>
        updateFilter({ sortBy: (typeof v === 'string' ? v : v.value) || 'nameAsc' }),
      onFilterByChange: (v: string) => updateFilter({ filterBy: v }),
      onGroupByChange: (v: { value?: string } | string) =>
        updateFilter({ groupBy: (typeof v === 'string' ? v : v.value) || 'type' }),
      onCategoryFilterChange: (v: { value?: string }) => updateFilter({ categoryFilter: v.value || 'all' }),
      onTypeFilterChange: (v: { value?: string }) => updateFilter({ typeFilter: v.value || 'all' }),
      onResetFilters: () =>
        updateFilter({ sortBy: 'nameAsc', filterBy: 'all', categoryFilter: 'all', typeFilter: 'all' }),
    }),
    [updateFilter]
  );

  const sidebarContextValue = useSidebar({
    hasOpenPane: isPaneOpen,
    position: 'right',
    persistanceKey: 'connections-sidebar',
    defaultToCompact: true,
    defaultToDocked: true,
    onClosePane: () => setIsPaneOpen(false),
    edgeMargin: 0,
    bottomMargin: 0,
  });

  const handleSearchChange = useCallback(
    (val: string) => {
      setQueryParams({
        search: val,
      });
    },
    [setQueryParams]
  );

  const remotePluginsAvailable = useIsRemotePluginsAvailable();

  const { error, plugins, isLoading } = useGetAll(
    {
      keyword: searchTerm,
      isInstalled: filterBy === 'installed' ? true : undefined,
      hasUpdate: filterBy === 'has-update' ? true : undefined,
    },
    sortBy
  );

  // Use filtering hooks with memoization
  const categoryFilterOptions = useCategoryFilterOptions(plugins);
  const { datasourceCardGridItems, appsCardGridItems } = useFilteredPlugins(
    plugins,
    groupBy,
    categoryFilter,
    typeFilter
  );
  const pluginsByCategory = usePluginsByCategory(plugins, typeFilter);

  // Memoize card click handler
  const onClickCardGridItem = useCallback(
    (e: MouseEvent<HTMLElement>, item: CardGridItem) => {
      if (!canCreateDataSources) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedItem(item);
        reportInteraction('connections_plugin_card_clicked', {
          plugin_id: item.id,
          creator_team: 'grafana_plugins_catalog',
          schema_version: '1.0.0',
        });
      }
    },
    [canCreateDataSources]
  );

  const handleCloseModal = useCallback(() => setSelectedItem(null), []);

  const hasActiveFilters =
    categoryFilter !== 'all' || typeFilter !== 'all' || filterBy !== 'all' || sortBy !== 'nameAsc';

  const showNoResults = !isLoading && !error && datasourceCardGridItems.length === 0 && appsCardGridItems.length === 0;

  return (
    <>
      {selectedItem && <NoAccessModal item={selectedItem} isOpen={true} onDismiss={handleCloseModal} />}
      <div className={styles.outerWrapper} {...sidebarContextValue.outerWrapperProps}>
        <div className={styles.mainContent}>
          <div className={styles.searchHeader}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <div className={styles.searchField}>
                <Field label={t('common.search', 'Search')} noMargin>
                  <SearchField value={searchTerm} onSearch={handleSearchChange} id="connections-search-field" />
                </Field>
              </div>
              <div className={styles.groupByControl}>
                <Field label={t('connections.add-new-connection.group-by', 'Group by')} noMargin>
                  <RadioButtonGroup value={groupBy} onChange={handlers.onGroupByChange} options={GROUP_BY_OPTIONS()} />
                </Field>
              </div>
            </Stack>
          </div>

          <div className={styles.contentWrap}>
            {isLoading && <LoadingPlaceholder text={t('common.loading', 'Loading...')} />}
            {error && <EmptyState variant="not-found" message={String(error)} />}
            {!isLoading && !error && (
              <PluginContentView
                groupBy={groupBy}
                datasourceCardGridItems={datasourceCardGridItems}
                appsCardGridItems={appsCardGridItems}
                pluginsByCategory={pluginsByCategory}
                onClickCardGridItem={onClickCardGridItem}
              />
            )}
            {showNoResults && (
              <EmptyState
                variant="not-found"
                message={t('connections.connect-data.empty-message', 'No results matching your query were found')}
              />
            )}
          </div>
        </div>
        <Sidebar contextValue={sidebarContextValue}>
          <Sidebar.Toolbar>
            <div className={styles.filterButtonWrapper}>
              {hasActiveFilters && <div className={styles.activeFilterDot} />}
              <Sidebar.Button
                icon="filter"
                title={t('connections.add-new-connection.filters', 'Filters')}
                onClick={() => setIsPaneOpen(!isPaneOpen)}
              />
            </div>
          </Sidebar.Toolbar>
          {isPaneOpen && (
            <Sidebar.OpenPane>
              <Sidebar.PaneHeader title={t('connections.add-new-connection.filters', 'Filters')}>
                <IconButton
                  name="history-alt"
                  size="md"
                  tooltip={t('connections.add-new-connection.reset-filters', 'Reset filters')}
                  aria-label={t('connections.add-new-connection.reset-filters', 'Reset filters')}
                  onClick={handlers.onResetFilters}
                  disabled={!hasActiveFilters}
                />
              </Sidebar.PaneHeader>
              <FilterSidebar
                state={{
                  groupBy,
                  categoryFilter,
                  typeFilter,
                  filterBy,
                  sortBy,
                }}
                handlers={{
                  onCategoryFilterChange: handlers.onCategoryFilterChange,
                  onTypeFilterChange: handlers.onTypeFilterChange,
                  onFilterByChange: handlers.onFilterByChange,
                  onSortByChange: handlers.onSortByChange,
                }}
                categoryFilterOptions={categoryFilterOptions}
                typeFilterOptions={TYPE_FILTER_OPTIONS()}
                filterByOptions={FILTER_BY_OPTIONS()}
                remotePluginsAvailable={remotePluginsAvailable}
              />
            </Sidebar.OpenPane>
          )}
        </Sidebar>
      </div>
    </>
  );
}
