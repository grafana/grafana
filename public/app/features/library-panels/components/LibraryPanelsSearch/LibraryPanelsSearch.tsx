import React, { useReducer } from 'react';
import { HorizontalGroup, useStyles2, VerticalGroup, FilterInput } from '@grafana/ui';
import { GrafanaTheme2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { LibraryElementDTO } from '../../types';
import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { FolderInfo } from '../../../../types';
import {
  folderFilterChanged,
  initialLibraryPanelsSearchState,
  libraryPanelsSearchReducer,
  panelFilterChanged,
  searchChanged,
  sortChanged,
} from './reducer';

export enum LibraryPanelsSearchVariant {
  Tight = 'tight',
  Spacious = 'spacious',
}

export interface LibraryPanelsSearchProps {
  onClick: (panel: LibraryElementDTO) => void;
  variant?: LibraryPanelsSearchVariant;
  showSort?: boolean;
  showPanelFilter?: boolean;
  showFolderFilter?: boolean;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
  currentFolderId?: number;
  perPage?: number;
}

export const LibraryPanelsSearch = ({
  onClick,
  variant = LibraryPanelsSearchVariant.Spacious,
  currentPanelId,
  currentFolderId,
  perPage = DEFAULT_PER_PAGE_PAGINATION,
  showPanelFilter = false,
  showFolderFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const styles = useStyles2(getStyles);
  const [{ sortDirection, panelFilter, folderFilter, searchQuery }, dispatch] = useReducer(libraryPanelsSearchReducer, {
    ...initialLibraryPanelsSearchState,
    folderFilter: currentFolderId ? [currentFolderId.toString(10)] : [],
  });
  const onFilterChange = (searchString: string) => dispatch(searchChanged(searchString));
  const onSortChange = (sorting: SelectableValue<string>) => dispatch(sortChanged(sorting));
  const onFolderFilterChange = (folders: FolderInfo[]) => dispatch(folderFilterChanged(folders));
  const onPanelFilterChange = (plugins: PanelPluginMeta[]) => dispatch(panelFilterChanged(plugins));

  if (variant === LibraryPanelsSearchVariant.Spacious) {
    return (
      <div className={styles.container}>
        <VerticalGroup spacing="lg">
          <FilterInput
            value={searchQuery}
            onChange={onFilterChange}
            placeholder={'Search by name or description'}
            width={0}
          />
          <HorizontalGroup
            spacing="sm"
            justify={(showSort && showPanelFilter) || showFolderFilter ? 'space-between' : 'flex-end'}
          >
            {showSort && (
              <SortPicker value={sortDirection} onChange={onSortChange} filter={['alpha-asc', 'alpha-desc']} />
            )}
            <HorizontalGroup spacing="sm" justify={showFolderFilter && showPanelFilter ? 'space-between' : 'flex-end'}>
              {showFolderFilter && <FolderFilter onChange={onFolderFilterChange} />}
              {showPanelFilter && <PanelTypeFilter onChange={onPanelFilterChange} />}
            </HorizontalGroup>
          </HorizontalGroup>
          <div className={styles.libraryPanelsView}>
            <LibraryPanelsView
              onClickCard={onClick}
              searchString={searchQuery}
              sortDirection={sortDirection}
              panelFilter={panelFilter}
              folderFilter={folderFilter}
              currentPanelId={currentPanelId}
              showSecondaryActions={showSecondaryActions}
              perPage={perPage}
            />
          </div>
        </VerticalGroup>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <VerticalGroup spacing="xs">
        <div className={styles.buttonRow}>
          <div className={styles.tightFilter}>
            <FilterInput value={searchQuery} onChange={onFilterChange} placeholder={'Search by name'} width={0} />
          </div>
          <div className={styles.tightSortFilter}>
            {showSort && <SortPicker value={sortDirection} onChange={onSortChange} />}
            {showFolderFilter && <FolderFilter onChange={onFolderFilterChange} maxMenuHeight={200} />}
            {showPanelFilter && <PanelTypeFilter onChange={onPanelFilterChange} maxMenuHeight={200} />}
          </div>
        </div>
        <div className={styles.libraryPanelsView}>
          <LibraryPanelsView
            onClickCard={onClick}
            searchString={searchQuery}
            sortDirection={sortDirection}
            panelFilter={panelFilter}
            folderFilter={folderFilter}
            currentPanelId={currentPanelId}
            showSecondaryActions={showSecondaryActions}
            perPage={perPage}
          />
        </div>
      </VerticalGroup>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      width: 100%;
      overflow-y: auto;
      padding: ${theme.spacing(1)};
      min-height: 400px;
    `,
    buttonRow: css`
      display: flex;
      justify-content: space-between;
      width: 100%;
      margin-top: ${theme.spacing(1.5)}; // Clear types link
    `,
    tightFilter: css`
      flex-grow: 1;
    `,
    tightSortFilter: css`
      flex-grow: 1;
      padding: ${theme.spacing(0, 0, 0, 0.5)};
    `,
    libraryPanelsView: css`
      width: 100%;
    `,
  };
}
