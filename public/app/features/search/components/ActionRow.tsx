import React, { Dispatch, FC, SetStateAction } from 'react';
import { css } from 'emotion';
import { HorizontalGroup, RadioButtonGroup, Select, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
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
  hideSelectedTags?: boolean;
}

export const ActionRow: FC<Props> = ({
  layout,
  onLayoutChange,
  onSortChange,
  onStarredFilterChange,
  onTagFilterChange,
  query,
  showStarredFilter,
  hideSelectedTags,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.actionRow}>
      <HorizontalGroup spacing="md">
        <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={layout} />
        <SortPicker onChange={onSortChange} value={query.sort} />
      </HorizontalGroup>
      <HorizontalGroup spacing="md" width="100%" justify="space-between">
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
          hideValues={hideSelectedTags}
          isClearable={!hideSelectedTags}
        />
      </HorizontalGroup>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: ${theme.spacing.md} 0;
      width: 100%;
    `,
  };
});
