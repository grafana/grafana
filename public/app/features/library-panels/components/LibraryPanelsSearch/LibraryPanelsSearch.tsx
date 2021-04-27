import React, { useCallback, useState } from 'react';
import { useAsync } from 'react-use';
import { getLibraryPanels } from '../../state/api';
import { HorizontalGroup, useStyles2, VerticalGroup } from '@grafana/ui';
import { GrafanaThemeV2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { FilterInput } from '../../../../core/components/FilterInput/FilterInput';
import { SortPicker } from '../../../../core/components/Select/SortPicker';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../core/constants';
import { LibraryPanelDTO } from '../../types';

export interface LibraryPanelsSearchProps {
  onClick: (panel: LibraryPanelDTO) => void;
  showSearchInput?: boolean;
  showSort?: boolean;
  showFilter?: boolean;
  showSecondaryActions?: boolean;
  currentPanelId?: string;
  perPage?: number;
}

export const LibraryPanelsSearch = ({
  onClick,
  currentPanelId,
  perPage = DEFAULT_PER_PAGE_PAGINATION,
  showSearchInput = false,
  showFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<string | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);
  const { value: searchResult, loading } = useAsync(async () => {
    return getLibraryPanels();
  });
  const styles = useStyles2(getStyles);
  const onSortChange = useCallback((sort: SelectableValue<string>) => setSortDirection(sort.value), []);
  const onFilterChange = useCallback((plugins: PanelPluginMeta[]) => setPanelFilter(plugins.map((p) => p.id)), []);
  const hasLibraryPanels = Boolean(searchResult?.libraryPanels.length);

  if (loading) {
    return <div>Loading global panels...</div>;
  }

  if (!hasLibraryPanels) {
    return <div>No global panels found</div>;
  }

  return (
    <div className={styles.container}>
      <VerticalGroup spacing="lg">
        {showSearchInput && (
          <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={'Search by name'} width={0} />
        )}
        <HorizontalGroup spacing="sm" justify={showSort && showFilter ? 'space-between' : 'flex-end'}>
          {showSort && <SortPicker value={sortDirection} onChange={onSortChange} />}
          {showFilter && <PanelTypeFilter onChange={onFilterChange} />}
        </HorizontalGroup>
        <div className={styles.libraryPanelsView}>
          <LibraryPanelsView
            onClickCard={onClick}
            searchString={searchQuery}
            sortDirection={sortDirection}
            panelFilter={panelFilter}
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
      label: container;
      width: 100%;
      overflow-y: auto;
    `,
    libraryPanelsView: css`
      label: libraryPanelsView;
      width: 100%;
    `,
  };
}
