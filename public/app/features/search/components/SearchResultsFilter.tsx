import React, { Dispatch, FC } from 'react';
import { css } from 'emotion';
import { Button, Select, Checkbox, stylesFactory, useTheme, HorizontalGroup } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { TagFilter } from 'app/core/components/TagFilter/TagFilter';
import { SearchSrv } from 'app/core/services/search_srv';
import { SearchAction } from '../types';
import { TOGGLE_ALL_CHECKED } from '../reducers/actionTypes';

type onSelectChange = (value: SelectableValue) => void;

export interface Props {
  allChecked?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
  deleteItem: () => void;
  moveTo: () => void;
  onStarredFilterChange: onSelectChange;
  onTagFilterChange: onSelectChange;
  selectedStarredFilter: boolean;
  selectedTagFilter: string[];
  dispatch: Dispatch<SearchAction>;
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
  dispatch,
  onStarredFilterChange,
  onTagFilterChange,
  selectedStarredFilter = false,
  selectedTagFilter,
}) => {
  const showActions = canDelete || canMove;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      <Checkbox value={allChecked} onChange={() => dispatch({ type: TOGGLE_ALL_CHECKED })} />
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
            size="sm"
            placeholder="Filter by starred"
            key={starredFilterOptions.find(f => f.value === selectedStarredFilter).label}
            options={starredFilterOptions}
            onChange={onStarredFilterChange}
          />

          <TagFilter
            size="sm"
            placeholder="Filter by tag"
            tags={selectedTagFilter}
            tagOptions={searchSrv.getDashboardTags}
            onChange={onTagFilterChange}
            hideValues
          />
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

      label {
        height: 20px;
        margin-left: 8px;
      }
    `,
  };
});
