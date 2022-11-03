import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { useStyles2, VerticalGroup, FilterInput } from '@grafana/ui';
import { FolderInfo } from 'app/types';

import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { LibraryElementDTO } from '../../types';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';

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
  currentFolderUID?: string;
  perPage?: number;
}

export const LibraryPanelsSearch = ({
  onClick,
  variant = LibraryPanelsSearchVariant.Spacious,
  currentPanelId,
  currentFolderUID,
  perPage = DEFAULT_PER_PAGE_PAGINATION,
  showPanelFilter = false,
  showFolderFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, variant), [variant]));

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);

  const [sortDirection, setSortDirection] = useState<SelectableValue<string>>({});
  const [folderFilter, setFolderFilter] = useState<string[]>(currentFolderUID ? [currentFolderUID] : []);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);

  const sortOrFiltersVisible = showSort || showPanelFilter || showFolderFilter;
  const verticalGroupSpacing = variant === LibraryPanelsSearchVariant.Tight ? 'lg' : 'xs';

  return (
    <div className={styles.container}>
      <VerticalGroup spacing={verticalGroupSpacing}>
        <div className={styles.gridContainer}>
          <div className={styles.filterInputWrapper}>
            <FilterInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name or description"
              width={0}
              escapeRegex={false}
            />
          </div>
          {sortOrFiltersVisible && (
            <SearchControls
              showSort={showSort}
              showPanelFilter={showPanelFilter}
              showFolderFilter={showFolderFilter}
              onSortChange={setSortDirection}
              onFolderFilterChange={setFolderFilter}
              onPanelFilterChange={setPanelFilter}
              sortDirection={sortDirection.value}
              variant={variant}
            />
          )}
        </div>

        <div className={styles.libraryPanelsView}>
          <LibraryPanelsView
            onClickCard={onClick}
            searchString={debouncedSearchQuery}
            sortDirection={sortDirection.value}
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

function getStyles(theme: GrafanaTheme2, variant: LibraryPanelsSearchVariant) {
  const tightLayout = css`
    flex-direction: row;
    row-gap: ${theme.spacing(1)};
  `;
  return {
    filterInputWrapper: css`
      flex-grow: ${variant === LibraryPanelsSearchVariant.Tight ? 1 : 'initial'};
    `,
    container: css`
      width: 100%;
      overflow-y: auto;
      padding: ${theme.spacing(1)};
    `,
    libraryPanelsView: css`
      width: 100%;
    `,
    gridContainer: css`
      ${variant === LibraryPanelsSearchVariant.Tight ? tightLayout : ''};
      display: flex;
      flex-direction: column;
      width: 100%;
      column-gap: ${theme.spacing(1)};
      row-gap: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(2)};
    `,
  };
}

interface SearchControlsProps {
  showSort: boolean;
  showPanelFilter: boolean;
  showFolderFilter: boolean;
  sortDirection?: string;
  onSortChange: (sortValue: SelectableValue) => void;
  onFolderFilterChange: (folder: string[]) => void;
  onPanelFilterChange: (plugins: string[]) => void;
  variant?: LibraryPanelsSearchVariant;
}

const SearchControls = React.memo(
  ({
    variant = LibraryPanelsSearchVariant.Spacious,
    showSort,
    showPanelFilter,
    showFolderFilter,
    sortDirection,
    onSortChange,
    onFolderFilterChange,
    onPanelFilterChange,
  }: SearchControlsProps) => {
    const styles = useStyles2(useCallback((theme) => getRowStyles(theme, variant), [variant]));
    const panelFilterChanged = useCallback(
      (plugins: PanelPluginMeta[]) => onPanelFilterChange(plugins.map((p) => p.id)),
      [onPanelFilterChange]
    );
    const folderFilterChanged = useCallback(
      (folders: FolderInfo[]) => onFolderFilterChange(folders.map((f) => f.uid ?? '')),
      [onFolderFilterChange]
    );

    return (
      <div className={styles.container}>
        {showSort && <SortPicker value={sortDirection} onChange={onSortChange} filter={['alpha-asc', 'alpha-desc']} />}
        {(showFolderFilter || showPanelFilter) && (
          <div className={styles.filterContainer}>
            {showFolderFilter && <FolderFilter onChange={folderFilterChanged} />}
            {showPanelFilter && <PanelTypeFilter onChange={panelFilterChanged} />}
          </div>
        )}
      </div>
    );
  }
);
SearchControls.displayName = 'SearchControls';

function getRowStyles(theme: GrafanaTheme2, variant = LibraryPanelsSearchVariant.Spacious) {
  const searchRowContainer = css`
    display: flex;
    gap: ${theme.spacing(1)};
    flex-grow: 1;
    flex-direction: row;
    justify-content: end;
  `;
  const searchRowContainerTight = css`
    ${searchRowContainer};
    flex-grow: initial;
    flex-direction: column;
    justify-content: normal;
  `;
  const filterContainer = css`
    display: flex;
    flex-direction: row;
    margin-left: auto;
    gap: 4px;
  `;
  const filterContainerTight = css`
    ${filterContainer};
    flex-direction: column;
    margin-left: initial;
  `;

  switch (variant) {
    case LibraryPanelsSearchVariant.Spacious:
      return {
        container: searchRowContainer,
        filterContainer: filterContainer,
      };
    case LibraryPanelsSearchVariant.Tight:
      return {
        container: searchRowContainerTight,
        filterContainer: filterContainerTight,
      };
  }
}
