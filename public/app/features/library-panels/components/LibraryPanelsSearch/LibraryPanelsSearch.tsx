import React, { useCallback, useState } from 'react';
import { HorizontalGroup, useStyles2, VerticalGroup } from '@grafana/ui';
import { GrafanaThemeV2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { FilterInput } from '../../../../core/components/FilterInput/FilterInput';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { LibraryPanelDTO } from '../../types';
import { FolderFilter } from '../../../../core/components/FolderFilter/FolderFilter';
import { FolderInfo } from '../../../../types';

export enum LibraryPanelsSearchVariant {
  Tight = 'tight',
  Spacious = 'spacious',
}

export interface LibraryPanelsSearchProps {
  onClick: (panel: LibraryPanelDTO) => void;
  variant?: LibraryPanelsSearchVariant;
  showSort?: boolean;
  showPanelFilter?: boolean;
  showFolderFilter?: boolean;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
  perPage?: number;
}

export const LibraryPanelsSearch = ({
  onClick,
  variant = LibraryPanelsSearchVariant.Spacious,
  currentPanelId,
  perPage = DEFAULT_PER_PAGE_PAGINATION,
  showPanelFilter = false,
  showFolderFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<string | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);
  const [folderFilter, setFolderFilter] = useState<string[]>([]);
  const styles = useStyles2(getStyles);
  const onSortChange = useCallback((sort: SelectableValue<string>) => setSortDirection(sort.value), []);
  const onFilterChange = useCallback((plugins: PanelPluginMeta[]) => setPanelFilter(plugins.map((p) => p.id)), []);
  const onFolderFilterChange = useCallback(
    (folders: FolderInfo[]) => setFolderFilter(folders.map((f) => String(f.id!))),
    []
  );

  if (variant === LibraryPanelsSearchVariant.Spacious) {
    return (
      <div className={styles.container}>
        <VerticalGroup spacing="lg">
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={'Search by name'} width={0} />
          <HorizontalGroup
            spacing="sm"
            justify={(showSort && showPanelFilter) || showFolderFilter ? 'space-between' : 'flex-end'}
          >
            {showSort && <SortPicker value={sortDirection} onChange={onSortChange} />}
            <HorizontalGroup spacing="sm" justify={showFolderFilter && showPanelFilter ? 'space-between' : 'flex-end'}>
              {showFolderFilter && <FolderFilter onChange={onFolderFilterChange} />}
              {showPanelFilter && <PanelTypeFilter onChange={onFilterChange} />}
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
            <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={'Search by name'} width={0} />
          </div>
          <div className={styles.tightSortFilter}>
            {showSort && <SortPicker value={sortDirection} onChange={onSortChange} />}
            {showFolderFilter && <FolderFilter onChange={onFolderFilterChange} maxMenuHeight={200} />}
            {showPanelFilter && <PanelTypeFilter onChange={onFilterChange} maxMenuHeight={200} />}
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

function getStyles(theme: GrafanaThemeV2) {
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
