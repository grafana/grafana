import { css, cx } from '@emotion/css';
import { memo, useCallback, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2, Stack, FilterInput } from '@grafana/ui';
import { FolderInfo } from 'app/types/folders';

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
  const styles = useStyles2(getStyles, variant);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);

  const [sortDirection, setSortDirection] = useState<SelectableValue<string>>({});
  const [folderFilter, setFolderFilter] = useState<string[]>(currentFolderUID ? [currentFolderUID] : []);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);

  const sortOrFiltersVisible = showSort || showPanelFilter || showFolderFilter;
  const verticalGroupSpacing = variant === LibraryPanelsSearchVariant.Tight ? 3 : 0.5;

  return (
    <div className={styles.container}>
      <Stack direction="column" gap={verticalGroupSpacing}>
        <div
          className={cx(styles.gridContainer, {
            [styles.tightLayout]: variant === LibraryPanelsSearchVariant.Tight,
          })}
        >
          <div className={styles.filterInputWrapper}>
            <FilterInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t(
                'library-panels.library-panels-search.placeholder-search-by-name-or-description',
                'Search by name, description or folder name'
              )}
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
      </Stack>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2, variant: LibraryPanelsSearchVariant) {
  return {
    filterInputWrapper: css({
      flexGrow: variant === LibraryPanelsSearchVariant.Tight ? 1 : 'initial',
    }),
    container: css({
      width: '100%',
      overflowY: 'auto',
      padding: theme.spacing(1),
    }),
    libraryPanelsView: css({
      width: '100%',
    }),
    gridContainer: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      columnGap: theme.spacing(1),
      rowGap: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    }),
    tightLayout: css({
      flexDirection: 'row',
      rowGap: theme.spacing(1),
    }),
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

const SearchControls = memo(
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
    const styles = useStyles2(getRowStyles);
    const panelFilterChanged = useCallback(
      (plugins: PanelPluginMeta[]) => onPanelFilterChange(plugins.map((p) => p.id)),
      [onPanelFilterChange]
    );
    const folderFilterChanged = useCallback(
      (folders: FolderInfo[]) => onFolderFilterChange(folders.map((f) => f.uid ?? '')),
      [onFolderFilterChange]
    );

    return (
      <div
        className={cx(styles.container, {
          [styles.containerTight]: variant === LibraryPanelsSearchVariant.Tight,
        })}
      >
        {showSort && <SortPicker value={sortDirection} onChange={onSortChange} filter={['alpha-asc', 'alpha-desc']} />}
        {(showFolderFilter || showPanelFilter) && (
          <div
            className={cx(styles.filterContainer, {
              [styles.filterContainerTight]: variant === LibraryPanelsSearchVariant.Tight,
            })}
          >
            {showFolderFilter && <FolderFilter onChange={folderFilterChanged} />}
            {showPanelFilter && <PanelTypeFilter onChange={panelFilterChanged} />}
          </div>
        )}
      </div>
    );
  }
);
SearchControls.displayName = 'SearchControls';

function getRowStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      flexGrow: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    }),
    containerTight: css({
      flexGrow: 'initial',
      flexDirection: 'column',
      justifyContent: 'normal',
    }),
    filterContainer: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
    }),
    filterContainerTight: css({
      flexDirection: 'column',
      marginLeft: 'initial',
    }),
  };
}
