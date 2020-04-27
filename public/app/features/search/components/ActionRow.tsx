import React, { Dispatch, FC, FormEvent, SetStateAction } from 'react';
import { css } from 'emotion';
import { HorizontalGroup, RadioButtonGroup, stylesFactory, useTheme, Checkbox } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
import { DashboardQuery, SearchLayout } from '../types';

export const layoutOptions = [
  { label: 'Folders', value: SearchLayout.Folders, icon: 'folder' },
  { label: 'List', value: SearchLayout.List, icon: 'list-ul' },
];

const searchSrv = new SearchSrv();

type onSelectChange = (value: SelectableValue) => void;
interface Props {
  onLayoutChange: Dispatch<SetStateAction<string>>;
  onSortChange: onSelectChange;
  onStarredFilterChange?: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: onSelectChange;
  query: DashboardQuery;
  showStarredFilter?: boolean;
  hideLayout?: boolean;
}

export const ActionRow: FC<Props> = ({
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
      <HorizontalGroup spacing="md" width="auto">
        {!hideLayout ? (
          <RadioButtonGroup options={layoutOptions} onChange={onLayoutChange} value={query.layout} />
        ) : null}
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
