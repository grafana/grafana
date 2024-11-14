import { css } from '@emotion/css';
import { useMemo, useState, FormEvent, MouseEvent } from 'react';

import { GrafanaTheme2, PluginType } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2, LoadingPlaceholder, EmptyState } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t } from 'app/core/internationalization';
import { RoadmapLinks } from 'app/features/plugins/admin/components/RoadmapLinks';
import { useGetAll } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types';

import { ROUTES } from '../../constants';

import { CardGrid, type CardGridItem } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoAccessModal } from './NoAccessModal';
import { Search } from './Search';

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
});

export function AddNewConnection() {
  const [queryParams, setQueryParams] = useQueryParams();
  const searchTerm = queryParams.search ? String(queryParams.search) : '';
  const [isNoAccessModalOpen, setIsNoAccessModalOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState<CardGridItem | null>(null);
  const styles = useStyles2(getStyles);
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);

  const handleSearchChange = (e: FormEvent<HTMLInputElement>) => {
    setQueryParams({
      search: e.currentTarget.value.toLowerCase(),
    });
  };

  const { error, plugins, isLoading } = useGetAll({
    keyword: searchTerm,
    type: PluginType.datasource,
  });

  const cardGridItems = useMemo(
    () =>
      plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
        angularDetected: plugin.angularDetected,
      })),
    [plugins]
  );

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

  const showNoResults = useMemo(() => !isLoading && !error && plugins.length < 1, [isLoading, error, plugins]);
  const categoryHeaderLabel = t('connections.connect-data.category-header-label', 'Data sources');

  return (
    <>
      {focusedItem && <NoAccessModal item={focusedItem} isOpen={isNoAccessModalOpen} onDismiss={closeModal} />}
      <Search onChange={handleSearchChange} value={searchTerm} />
      {/* We need this extra spacing when there are no filters */}
      <div className={styles.spacer} />
      <CategoryHeader iconName="database" label={categoryHeaderLabel} />
      {isLoading ? (
        <LoadingPlaceholder text="Loading..." />
      ) : !!error ? (
        <p>Error: {error.message}</p>
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
