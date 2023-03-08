import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { PluginType } from '@grafana/data';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useGetAllWithFilters } from 'app/features/plugins/admin/state/hooks';
import { AccessControlAction } from 'app/types';

import { ROUTES } from '../../constants';

import { CardGrid, type CardGridItem } from './CardGrid';
import { CategoryHeader } from './CategoryHeader';
import { NoAccessModal } from './NoAccessModal';
import { NoResults } from './NoResults';
import { Search } from './Search';

const getStyles = () => ({
  spacer: css`
    height: 16px;
  `,
  modal: css`
    width: 500px;
  `,
  modalContent: css`
    overflow: visible;
  `,
});

export function ConnectData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isNoAccessModalOpen, setIsNoAccessModalOpen] = useState(false);
  const [focusedItem, setFocusedItem] = useState<CardGridItem | null>(null);
  const styles = useStyles2(getStyles);
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);

  const handleSearchChange = (e: React.FormEvent<HTMLInputElement>) => {
    setSearchTerm(e.currentTarget.value.toLowerCase());
  };

  const { isLoading, error, plugins } = useGetAllWithFilters({
    query: searchTerm,
    filterBy: '',
    filterByType: PluginType.datasource,
  });

  const cardGridItems = useMemo(
    () =>
      plugins.map((plugin) => ({
        id: plugin.id,
        name: plugin.name,
        description: plugin.description,
        logo: plugin.info.logos.small,
        url: ROUTES.DataSourcesDetails.replace(':id', plugin.id),
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

  return (
    <>
      {focusedItem && <NoAccessModal item={focusedItem} isOpen={isNoAccessModalOpen} onDismiss={closeModal} />}
      <Search onChange={handleSearchChange} />
      {/* We need this extra spacing when there are no filters */}
      <div className={styles.spacer} />
      <CategoryHeader iconName="database" label="Data sources" />
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
