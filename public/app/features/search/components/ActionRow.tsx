import React, { Dispatch, FC, SetStateAction } from 'react';
import { css } from 'emotion';
import { HorizontalGroup, RadioButtonGroup, stylesFactory, useTheme, Checkbox } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
import { layoutOptions } from '../hooks/useSearchLayout';
import { DashboardQuery } from '../types';

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
  hideLayout?: boolean;
}

export const ActionRow: FC<Props> = ({
  layout,
  onLayoutChange,
  onSortChange,
  onStarredFilterChange = () => {},
  onTagFilterChange,
  query,
  showStarredFilter,
  hideLayout,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.actionRow}>
      <HorizontalGroup spacing="md">
        {!hideLayout ? <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={layout} /> : null}
        <SortPicker onChange={onSortChange} value={query.sort} />
      </HorizontalGroup>
      <HorizontalGroup spacing="md" width="auto">
        {showStarredFilter && <Checkbox label="Filter by starred" onChange={onStarredFilterChange} />}
        <TagFilter
          placeholder="Filter by tag"
          tags={query.tag}
          tagOptions={searchSrv.getDashboardTags}
          onChange={onTagFilterChange}
        />
      </HorizontalGroup>
    </div>
  );
};

ActionRow.displayName = 'ActionRow';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    actionRow: css`
      display: none;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: ${theme.spacing.md} 0;
        width: 100%;
      }
    `,
  };
});
