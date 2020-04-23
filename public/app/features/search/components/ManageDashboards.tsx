import React, { FC, useState, memo, useRef } from 'react';
import { css } from 'emotion';
import { Icon, TagList, HorizontalGroup, stylesFactory, useTheme } from '@grafana/ui';
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
import { SearchField } from './SearchField';
import { useSearchLayout } from '../hooks/useSearchLayout';
import { SearchLayout } from '../types';

export interface Props {
  folderId?: number;
  folderUid?: string;
}

const { isEditor } = contextSrv;

export const ManageDashboards: FC<Props> = memo(({ folderId, folderUid }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const wrapperRef = useRef(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const queryParams = { skipRecent: true, skipStarred: true, folderIds: folderId ? [folderId] : [] };
  const {
    query,
    hasFilters,
    onQueryChange,
    onRemoveStarred,
    onTagRemove,
    onClearFilters,
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

  const { layout, setLayout } = useSearchLayout(query);

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
    <div className="dashboard-list">
      <HorizontalGroup justify="space-between">
        <SearchField query={query} onChange={onQueryChange} className={styles.searchField} />
        <DashboardActions isEditor={isEditor} canEdit={hasEditPermissionInFolders || canSave} folderId={folderId} />
      </HorizontalGroup>

      {hasFilters && (
        <HorizontalGroup>
          <div className="gf-form-inline">
            {query.tag.length > 0 && (
              <div className="gf-form">
                <label className="gf-form-label width-4">Tags</label>
                <TagList tags={query.tag} onClick={onTagRemove} />
              </div>
            )}
            {query.starred && (
              <div className="gf-form">
                <label className="gf-form-label">
                  <a className="pointer" onClick={onRemoveStarred}>
                    <Icon name="check" />
                    Starred
                  </a>
                </label>
              </div>
            )}
            {query.sort && (
              <div className="gf-form">
                <label className="gf-form-label">
                  <a className="pointer" onClick={() => onSortChange(null)}>
                    Sort: {query.sort.label}
                  </a>
                </label>
              </div>
            )}
            <div className="gf-form">
              <label className="gf-form-label">
                <a
                  className="pointer"
                  onClick={() => {
                    onClearFilters();
                    setLayout(SearchLayout.Folders);
                  }}
                >
                  <Icon name="times" />
                  &nbsp;Clear
                </a>
              </label>
            </div>
          </div>
        </HorizontalGroup>
      )}

      <div className="search-results">
        {results?.length > 0 && (
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
        )}
        <div ref={wrapperRef}>
          <SearchResults
            loading={loading}
            results={results}
            editable
            onTagSelected={onTagAdd}
            onToggleSection={onToggleSection}
            onToggleChecked={onToggleChecked}
            layout={layout}
            wrapperRef={wrapperRef}
          />
        </div>
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
    searchField: css`
      height: auto;
      border-bottom: none;
      padding: 0;
      margin: 0;
      input {
        width: 400px;
      }
    `,
  };
});
