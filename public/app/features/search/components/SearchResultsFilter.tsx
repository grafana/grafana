import React, { FC } from 'react';
import { css } from 'emotion';
import { Button, Forms, Select, stylesFactory, useTheme, HorizontalGroup } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';

type onSelectChange = (value: SelectableValue) => void;

export interface Props {
  allChecked?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
  deleteItem: () => void;
  moveTo: () => void;
  onSelectAllChanged: any;
  onStarredFilterChange: onSelectChange;
  onTagFilterChange: onSelectChange;
  selectedStarredFilter: string;
  selectedTagFilter: string;
  tagFilterOptions: SelectableValue[];
}

const starredFilterOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export const SearchResultsFilter: FC<Props> = ({
  allChecked,
  canDelete,
  canMove,
  deleteItem,
  moveTo,
  onSelectAllChanged,
  onStarredFilterChange,
  onTagFilterChange,
  selectedStarredFilter,
  selectedTagFilter,
  tagFilterOptions,
}) => {
  const showActions = canDelete || canMove;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      <Forms.Checkbox value={allChecked} onChange={onSelectAllChanged} />
      {showActions ? (
        <HorizontalGroup spacing="md">
          <Button disabled={!canMove} onClick={moveTo} icon="fa fa-exchange" variant="secondary">
            Move
          </Button>
          <Button disabled={!canDelete} onClick={deleteItem} icon="fa fa-trash" variant="destructive">
            Delete
          </Button>
        </HorizontalGroup>
      ) : (
        <HorizontalGroup spacing="md">
          <Select
            size="sm"
            placeholder="Filter by starred"
            key={selectedStarredFilter}
            options={starredFilterOptions}
            onChange={onStarredFilterChange}
          />

          <Select
            size="sm"
            placeholder="Filter by tag"
            key={selectedTagFilter}
            options={tagFilterOptions}
            onChange={onTagFilterChange}
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
