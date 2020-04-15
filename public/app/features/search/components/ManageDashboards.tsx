import React, { FC, useReducer, useState } from 'react';
import { contextSrv } from 'app/core/services/context_srv';
import { useDebounce } from 'react-use';
import { css } from 'emotion';
import { Icon, TagList, HorizontalGroup, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { SearchSrv } from 'app/core/services/search_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { manageDashboardsState, manageDashboardsReducer } from '../reducers/manageDashboards';
import {
  FETCH_ITEMS,
  FETCH_RESULTS,
  TOGGLE_EDIT_PERMISSIONS,
  TOGGLE_CAN_SAVE,
  TOGGLE_SECTION,
} from '../reducers/actionTypes';
import { DashboardSection } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { MoveToFolderModal } from './MoveToFolderModal';
import { defaultQuery } from '../reducers/searchQueryReducer';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { SearchResultsFilter } from './SearchResultsFilter';
import { SearchResults } from './SearchResults';
import { DashboardActions } from './DashboardActions';
import { SearchField } from './SearchField';

export interface Props {
  folderId?: number;
  folderUid?: string;
}

const searchSrv = new SearchSrv();

const { isEditor } = contextSrv;

export const ManageDashboards: FC<Props> = ({ folderId, folderUid }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
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
  } = useSearchQuery(queryParams);

  const [{ canSave, allChecked, hasEditPermissionInFolders, results, loading }, dispatch] = useReducer(
    manageDashboardsReducer,
    {
      ...manageDashboardsState,
      hasEditPermissionInFolders: contextSrv.hasEditPermissionInFolders,
    }
  );

  const search = () => {
    searchSrv
      .search(query)
      .then(results => {
        dispatch({ type: FETCH_RESULTS, payload: results });
      })
      .then(() => {
        if (!folderUid) {
          return undefined;
        }

        return backendSrv.getFolderByUid(folderUid).then(folder => {
          dispatch({ type: TOGGLE_CAN_SAVE, payload: folder.canSave });
          if (!folder.canSave) {
            dispatch({ type: TOGGLE_EDIT_PERMISSIONS, payload: false });
          }
        });
      });
  };

  useDebounce(search, 300, [query, folderUid]);

  const onMoveTo = () => {
    setIsMoveModalOpen(true);
  };

  const onItemDelete = () => {
    setIsDeleteModalOpen(true);
  };

  // TODO move to reusable hook
  const onToggleSection = (section: DashboardSection) => {
    if (!section.items.length) {
      backendSrv.search({ ...defaultQuery, folderIds: [section.id] }).then(items => {
        dispatch({ type: FETCH_ITEMS, payload: { section, items } });
        dispatch({ type: TOGGLE_SECTION, payload: section });
      });
    } else {
      dispatch({ type: TOGGLE_SECTION, payload: section });
    }
  };

  // TODO Memoize?
  const canMove = results.some((result: DashboardSection) => result.items.some(item => item.checked));
  const canDelete = canMove || results.some((result: DashboardSection) => result.checked);

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
            <div className="gf-form">
              <label className="gf-form-label">
                <a className="pointer" onClick={onClearFilters}>
                  <Icon name="times" />
                  &nbsp;Clear
                </a>
              </label>
            </div>
          </div>
        </HorizontalGroup>
      )}

      <div className="search-results">
        <SearchResultsFilter
          allChecked={allChecked}
          canDelete={canDelete}
          canMove={canMove}
          deleteItem={onItemDelete}
          moveTo={onMoveTo}
          dispatch={dispatch}
          onStarredFilterChange={onStarredFilterChange}
          onTagFilterChange={onTagFilterChange}
          selectedStarredFilter={query.starred}
          selectedTagFilter={query.tag}
        />
        <div className="search-results-container">
          <SearchResults
            loading={loading}
            results={results}
            editable
            onTagSelected={onTagAdd}
            onToggleSection={onToggleSection}
            dispatch={dispatch}
          />
        </div>
      </div>
      <ConfirmDeleteModal
        dispatch={dispatch}
        results={results}
        isOpen={isDeleteModalOpen}
        onDismiss={() => setIsDeleteModalOpen(false)}
      />
      <MoveToFolderModal
        dispatch={dispatch}
        results={results}
        isOpen={isMoveModalOpen}
        onDismiss={() => setIsMoveModalOpen(false)}
      />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    searchField: css`
      padding: 0;
      margin: 0;
      width: 400px;
    `,
  };
});
