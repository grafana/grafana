import { css } from '@emotion/css';
import React, { FC, memo, useState } from 'react';

import { GrafanaTheme } from '@grafana/data';
import { FilterInput, Spinner, stylesFactory, useTheme } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO } from 'app/types';

import { useManageDashboards } from '../hooks/useManageDashboards';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { SearchLayout } from '../types';

import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { DashboardActions } from './DashboardActions';
import { MoveToFolderModal } from './MoveToFolderModal';
import { SearchResults } from './SearchResults';
import { SearchResultsFilter } from './SearchResultsFilter';

export interface Props {
  folder?: FolderDTO;
}

const { isEditor } = contextSrv;

export const ManageDashboards: FC<Props> = memo(({ folder }) => {
  const folderId = folder?.id;
  const folderUid = folder?.uid;
  const theme = useTheme();
  const styles = getStyles(theme);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const defaultLayout = folderId ? SearchLayout.List : SearchLayout.Folders;
  const queryParamsDefaults = {
    skipRecent: true,
    skipStarred: true,
    folderIds: folderId ? [folderId] : [],
    layout: defaultLayout,
  };

  const {
    query,
    hasFilters,
    onQueryChange,
    onTagFilterChange,
    onStarredFilterChange,
    onTagAdd,
    onSortChange,
    onLayoutChange,
  } = useSearchQuery(queryParamsDefaults);

  const {
    results,
    loading,
    initialLoading,
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
    noFolders,
    showPreviews,
    setShowPreviews,
  } = useManageDashboards(query, {}, folder);

  const onMoveTo = () => {
    setIsMoveModalOpen(true);
  };

  const onItemDelete = () => {
    setIsDeleteModalOpen(true);
  };

  if (initialLoading) {
    return <Spinner className={styles.spinner} />;
  }

  if (noFolders && !hasFilters) {
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
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow m-r-2">
          <FilterInput value={query.query} onChange={onQueryChange} placeholder={'Search dashboards by name'} />
        </div>
        <DashboardActions isEditor={isEditor} canEdit={hasEditPermissionInFolders || canSave} folderId={folderId} />
      </div>

      <div className={styles.results}>
        <SearchResultsFilter
          allChecked={allChecked}
          canDelete={hasEditPermissionInFolders && canDelete}
          canMove={hasEditPermissionInFolders && canMove}
          deleteItem={onItemDelete}
          moveTo={onMoveTo}
          setShowPreviews={setShowPreviews}
          onToggleAllChecked={onToggleAllChecked}
          onStarredFilterChange={onStarredFilterChange}
          onSortChange={onSortChange}
          onTagFilterChange={onTagFilterChange}
          query={query}
          showPreviews={showPreviews}
          hideLayout={!!folderUid}
          onLayoutChange={onLayoutChange}
          editable={hasEditPermissionInFolders}
        />
        <SearchResults
          loading={loading}
          results={results}
          editable={hasEditPermissionInFolders}
          onTagSelected={onTagAdd}
          onToggleSection={onToggleSection}
          onToggleChecked={onToggleChecked}
          layout={query.layout}
          showPreviews={showPreviews}
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

ManageDashboards.displayName = 'ManageDashboards';

export default ManageDashboards;

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    results: css`
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
      padding-top: ${theme.spacing.lg};
    `,
    spinner: css`
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    `,
  };
});
