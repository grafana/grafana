import React, { FC, memo, useState } from 'react';
import { css } from 'emotion';
import { HorizontalGroup, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { useManageDashboards } from '../hooks/useManageDashboards';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';
import { DashboardActions } from './DashboardActions';
import { useSearchLayout } from '../hooks/useSearchLayout';
import { SearchLayout } from '../types';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';

export interface Props {
  folderId?: number;
  folderUid?: string;
}

const { isEditor } = contextSrv;

export const ManageDashboards: FC<Props> = memo(({ folderId, folderUid }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const queryParams = { skipRecent: true, skipStarred: true, folderIds: folderId ? [folderId] : [] };
  const {
    query,
    hasFilters,
    onQueryChange,
    onTagFilterChange,
    onStarredFilterChange,
    onTagAdd,
    onSortChange,
  } = useSearchQuery(queryParams);

  const {
    results,
    loading,
    canSave,
    allChecked,
    hasEditPermissionInFolders,
    canMove,
    canDelete,
    onToggleSection,
    onToggleChecked,
    onToggleAllChecked,
    onDeleteItems,
    onMoveItems,
  } = useManageDashboards(query, { hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders }, folderUid);

  const defaultLayout = folderId ? SearchLayout.List : SearchLayout.Folders;
  const { layout, setLayout } = useSearchLayout(query, defaultLayout);

  const onMoveTo = () => {
    setIsMoveModalOpen(true);
  };

  const onItemDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const onLayoutChange = (layout: string) => {
    setLayout(layout);
    if (query.sort) {
      onSortChange(null);
    }
  };

  if (canSave && folderId && !hasFilters && results.length === 0) {
    return (
      <EmptyListCTA
        title="This folder doesn't have any dashboards yet"
        buttonIcon="plus"
        buttonTitle="Create Dashboard"
        buttonLink={`dashboard/new?folderId=${folderId}`}
        proTip="Add/move dashboards to your folder at ->"
        proTipLink="dashboards"
        proTipLinkTitle="Manage dashboards"
        proTipTarget=""
      />
    );
  }

  return (
    <div className={styles.container}>
      <div>
        <HorizontalGroup justify="space-between">
          <FilterInput
            labelClassName="gf-form--has-input-icon"
            inputClassName="gf-form-input width-20"
            value={query.query}
            onChange={onQueryChange}
            placeholder={'Search dashboards by name'}
          />
          <DashboardActions isEditor={isEditor} canEdit={hasEditPermissionInFolders || canSave} folderId={folderId} />
        </HorizontalGroup>
      </div>

      <div className={styles.results}>
        <SearchResultsFilter
          allChecked={allChecked}
          canDelete={canDelete}
          canMove={canMove}
          deleteItem={onItemDelete}
          moveTo={onMoveTo}
          onToggleAllChecked={onToggleAllChecked}
          onStarredFilterChange={onStarredFilterChange}
          onSortChange={onSortChange}
          onTagFilterChange={onTagFilterChange}
          query={query}
          layout={layout}
          hideLayout={!!folderUid}
          onLayoutChange={onLayoutChange}
        />
        <SearchResults
          loading={loading}
          results={results}
          editable
          onTagSelected={onTagAdd}
          onToggleSection={onToggleSection}
          onToggleChecked={onToggleChecked}
          layout={layout}
        />
      </div>
      <ConfirmDeleteModal
        onDeleteItems={onDeleteItems}
        results={results}
        isOpen={isDeleteModalOpen}
        onDismiss={() => setIsDeleteModalOpen(false)}
      />
      <MoveToFolderModal
        onMoveItems={onMoveItems}
        results={results}
        isOpen={isMoveModalOpen}
        onDismiss={() => setIsMoveModalOpen(false)}
      />
    </div>
  );
});

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 100%;
    `,
    results: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      height: 100%;
      margin-top: ${theme.spacing.xl};
    `,
  };
});
