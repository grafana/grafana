import { css } from '@emotion/css';
import { memo, useCallback, useState, type JSX } from 'react';
import { useDebounce } from 'react-use';

import { type GrafanaTheme2, type PanelPluginMeta, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, FilterInput, useStyles2 } from '@grafana/ui';

import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { type LibraryElementDTO } from '../../types';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';

export interface LibraryPanelsSearchProps {
  onClick: (panel: LibraryElementDTO) => void;
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
  currentPanelId,
  currentFolderUID,
  perPage = DEFAULT_PER_PAGE_PAGINATION,
  showPanelFilter = false,
  showFolderFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useDebounce(() => setDebouncedSearchQuery(searchQuery), 200, [searchQuery]);

  const [sortDirection, setSortDirection] = useState<SelectableValue<string>>({});
  const [folderFilter, setFolderFilter] = useState<string[]>(currentFolderUID ? [currentFolderUID] : []);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);

  const sortOrFiltersVisible = showSort || showPanelFilter || showFolderFilter;

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
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
        {sortOrFiltersVisible && (
          <SearchControls
            showSort={showSort}
            showPanelFilter={showPanelFilter}
            showFolderFilter={showFolderFilter}
            onSortChange={setSortDirection}
            onFolderFilterChange={setFolderFilter}
            onPanelFilterChange={setPanelFilter}
            sortDirection={sortDirection.value}
          />
        )}
      </Stack>

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
    </Stack>
  );
};

interface SearchControlsProps {
  showSort: boolean;
  showPanelFilter: boolean;
  showFolderFilter: boolean;
  sortDirection?: string;
  onSortChange: (sortValue: SelectableValue) => void;
  onFolderFilterChange: (folder: string[]) => void;
  onPanelFilterChange: (plugins: string[]) => void;
}

const SearchControls = memo(
  ({
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
      (folders: string[]) => onFolderFilterChange(folders),
      [onFolderFilterChange]
    );

    return (
      <div className={styles.container}>
        {showSort && (
          <div className={styles.responsiveFilter}>
            <SortPicker
              value={sortDirection}
              onChange={onSortChange}
              getSortOptions={async () => {
                // This needs to match whatever is defined in
                // pkg/services/libraryelements/database.go#getAllLibraryElements
                return [
                  {
                    value: 'alpha-asc',
                    label: t('library-panels.search-controls.label.alphabetically-az', 'Alphabetically (A–Z)'),
                  },
                  {
                    value: 'alpha-desc',
                    label: t('library-panels.search-controls.label.alphabetically-za', 'Alphabetically (Z–A)'),
                  },
                ];
              }}
            />
          </div>
        )}
        {(showFolderFilter || showPanelFilter) && (
          <Stack gap={1} wrap grow={1} justifyContent="flex-end">
            {showFolderFilter && (
              <div className={styles.responsiveFilter}>
                <FolderFilter onChange={folderFilterChanged} />
              </div>
            )}
            {showPanelFilter && (
              <div className={styles.responsiveFilter}>
                <PanelTypeFilter onChange={panelFilterChanged} />
              </div>
            )}
          </Stack>
        )}
      </div>
    );
  }
);
SearchControls.displayName = 'SearchControls';

const getRowStyles = (theme: GrafanaTheme2) => ({
  container: css({
    container: 'search-controls-row / inline-size',
    display: 'flex',
    flexGrow: 1,
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
  }),
  responsiveFilter: css({
    width: theme.spacing(24),
    [theme.breakpoints.container.down('md', 'search-controls-row')]: {
      flexGrow: 1,
    },
  }),
});
