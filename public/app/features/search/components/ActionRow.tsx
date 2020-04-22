import React, { Dispatch, FC, SetStateAction } from 'react';
import { HorizontalGroup, RadioButtonGroup, Select, stylesFactory, useTheme } from '@grafana/ui';
import { SortPicker } from '../../../core/components/Select/SortPicker';
import { TagFilter } from '../../../core/components/TagFilter/TagFilter';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { css } from 'emotion';
import { SearchSrv } from '../../../core/services/search_srv';
import { layoutOptions } from '../hooks/useSearchLayout';
import { DashboardQuery } from '../types';

const starredFilterOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const searchSrv = new SearchSrv();

type onSelectChange = (value: SelectableValue) => void;
interface Props {
  layout: string;
  onLayoutChange: Dispatch<SetStateAction<string>>;
  onSortChange: onSelectChange;
  onStarredFilterChange?: onSelectChange;
  onTagFilterChange: onSelectChange;
  query: DashboardQuery;
  showStarredFilter?: boolean;
}

export const ActionRow: FC<Props> = ({
  layout,
  onLayoutChange,
  onSortChange,
  onStarredFilterChange,
  onTagFilterChange,
  query,
  showStarredFilter,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.actionRow}>
      <HorizontalGroup spacing="md">
        <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={layout} />
        <SortPicker onChange={onSortChange} value={query.sort} />
      </HorizontalGroup>
      <div className={styles.tagContainer}>
        {showStarredFilter && (
          <Select
            width={20}
            placeholder="Filter by starred"
            key={starredFilterOptions?.find(f => f.value === query.starred)?.label}
            options={starredFilterOptions}
            onChange={onStarredFilterChange}
          />
        )}

        <TagFilter
          placeholder="Filter by tag"
          tags={query.tag}
          tagOptions={searchSrv.getDashboardTags}
          onChange={onTagFilterChange}
          hideValues
        />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${theme.spacing.md} 0;
      width: 100%;
    `,
    tagContainer: css`
      display: flex;
      min-width: 200px;
      margin-left: ${theme.spacing.md};
    `,
  };
});
