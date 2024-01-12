import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PluginType } from '@grafana/data';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { t } from 'app/core/internationalization';
import { useGetAll } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types';

import { ROUTES } from '../../constants';

import { CardGrid, type CardGridItem } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoAccessModal } from './NoAccessModal';
import { NoResults } from './NoResults';
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

  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
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

  const onClickCardGridItem = (e: React.MouseEvent<HTMLElement>, item: CardGridItem) => {
    if (!canCreateDataSources) {
      e.preventDefault();
      e.stopPropagation();

      openModal(item);
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
      {showNoResults && <NoResults />}
    </>
  );
}
