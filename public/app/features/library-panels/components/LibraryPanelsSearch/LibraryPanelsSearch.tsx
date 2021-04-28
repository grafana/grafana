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

export interface LibraryPanelsSearchProps {
  onClick: (panel: LibraryPanelDTO) => void;
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
  showFilter = false,
  showSort = false,
  showSecondaryActions = false,
}: LibraryPanelsSearchProps): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<string | undefined>(undefined);
  const [panelFilter, setPanelFilter] = useState<string[]>([]);
  const styles = useStyles2(getStyles);
  const onSortChange = useCallback((sort: SelectableValue<string>) => setSortDirection(sort.value), []);
  const onFilterChange = useCallback((plugins: PanelPluginMeta[]) => setPanelFilter(plugins.map((p) => p.id)), []);

  return (
    <div className={styles.container}>
      <VerticalGroup spacing={showSort || showFilter ? 'lg' : 'xs'}>
        <FilterInput value={searchQuery} onChange={setSearchQuery} placeholder={'Search by name'} width={0} />
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
      width: 100%;
      overflow-y: auto;
      padding: ${theme.spacing(1)};
    `,
    libraryPanelsView: css`
      width: 100%;
    `,
  };
}
