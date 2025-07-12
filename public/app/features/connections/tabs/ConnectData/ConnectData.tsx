import { css } from '@emotion/css';
import { useMemo, useState, MouseEvent } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { PluginType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationSearchToObject, reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, EmptyState, Field, RadioButtonGroup, Tooltip, Combobox, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { HorizontalGroup } from 'app/features/plugins/admin/components/HorizontalGroup';
import { RoadmapLinks } from 'app/features/plugins/admin/components/RoadmapLinks';
import { SearchField } from 'app/features/plugins/admin/components/SearchField';
import { Sorters } from 'app/features/plugins/admin/helpers';
import { useHistory } from 'app/features/plugins/admin/hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types/accessControl';

import { ROUTES } from '../../constants';

import { CardGrid, type CardGridItem } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoAccessModal } from './NoAccessModal';

const getStyles = (theme: GrafanaTheme2) => ({
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
  const sortBy = (locationSearch.sortBy as Sorters) || Sorters.nameAsc;
  const filterBy = locationSearch.filterBy?.toString() || 'all';
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
      type: PluginType.datasource,
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

  const cardGridItems = useMemo(
    () =>
      plugins.map((plugin) => ({
        ...plugin,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
      })),
    [plugins]
  );

  const onSortByChange = (value: SelectableValue<string>) => {
    history.push({ query: { sortBy: value.value } });
  };

  const onFilterByChange = (value: string) => {
    history.push({ query: { filterBy: value } });
  };

  const showNoResults = useMemo(() => !isLoading && !error && plugins.length < 1, [isLoading, error, plugins]);
  const categoryHeaderLabel = t('connections.connect-data.category-header-label', 'Data sources');

  return (
    <>
      {focusedItem && <NoAccessModal item={focusedItem} isOpen={isNoAccessModalOpen} onDismiss={closeModal} />}
      <HorizontalGroup wrap>
        <Field label={t('common.search', 'Search')}>
          <SearchField value={searchTerm} onSearch={handleSearchChange} />
        </Field>
        <HorizontalGroup className={styles.actionBar}>
          {/* Filter by installed / all */}
          {remotePluginsAvailable ? (
            <Field label={t('plugins.filter.state', 'State')}>
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
                <Field label={t('plugins.filter.state', 'State')}>
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
          <Field label={t('plugins.filter.sort', 'Sort')}>
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
                { value: 'downloads', label: t('connections.add-new-connection.label.by-downloads', 'By downloads') },
              ]}
            />
          </Field>
        </HorizontalGroup>
      </HorizontalGroup>
      <CategoryHeader iconName="database" label={categoryHeaderLabel} />
      {isLoading ? (
        <LoadingPlaceholder text={t('common.loading', 'Loading...')} />
      ) : !!error ? (
        <Trans i18nKey="alerting.policies.update-errors.error-code" values={{ error: error.message }}>
          Error message: "{{ error: error.message }}"
        </Trans>
      ) : (
        <CardGrid items={cardGridItems} onClickItem={onClickCardGridItem} />
      )}
      {showNoResults && (
        <EmptyState
          variant="not-found"
          message={t('connections.connect-data.empty-message', 'No results matching your query were found')}
        />
      )}
      <RoadmapLinks />
    </>
  );
}
