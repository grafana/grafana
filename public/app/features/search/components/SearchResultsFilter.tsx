import React, { FC } from 'react';
import { css } from 'emotion';
import { Button, Select, Checkbox, stylesFactory, useTheme, HorizontalGroup } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { SearchSrv } from 'app/core/services/search_srv';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { DashboardQuery } from '../types';

type onSelectChange = (value: SelectableValue) => void;

export interface Props {
  allChecked?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
  deleteItem: () => void;
  moveTo: () => void;
  onStarredFilterChange: onSelectChange;
  onTagFilterChange: onSelectChange;
  onToggleAllChecked: () => void;
  query: DashboardQuery;
  onSortChange: onSelectChange;
}

const starredFilterOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

const searchSrv = new SearchSrv();

export const SearchResultsFilter: FC<Props> = ({
  allChecked,
  canDelete,
  canMove,
  deleteItem,
  moveTo,
  onToggleAllChecked,
  onStarredFilterChange,
  onTagFilterChange,
  query,
  onSortChange,
}) => {
  const showActions = canDelete || canMove;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      <Checkbox value={allChecked} onChange={onToggleAllChecked} />
      {showActions ? (
        <HorizontalGroup spacing="md">
          <Button disabled={!canMove} onClick={moveTo} icon="exchange-alt" variant="secondary">
            Move
          </Button>
          <Button disabled={!canDelete} onClick={deleteItem} icon="trash-alt" variant="destructive">
            Delete
          </Button>
        </HorizontalGroup>
      ) : (
        <HorizontalGroup spacing="md">
          <Select
            width={20}
            placeholder="Filter by starred"
            key={starredFilterOptions?.find(f => f.value === query.starred)?.label}
            options={starredFilterOptions}
            onChange={onStarredFilterChange}
          />

          <TagFilter
            placeholder="Filter by tag"
            tags={query.tag}
            tagOptions={searchSrv.getDashboardTags}
            onChange={onTagFilterChange}
            hideValues
          />

          <SortPicker onChange={onSortChange} value={query.sort} />
        </HorizontalGroup>
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      height: 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${theme.spacing.sm};

      label {
        height: 20px;
        margin-left: 8px;
      }
    `,
  };
});
