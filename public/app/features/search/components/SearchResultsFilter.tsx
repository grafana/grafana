import React, { FC } from 'react';
import { css } from 'emotion';
import { Button, Forms } from '@grafana/ui';

interface Props {
  allChecked: boolean;
  onSelectAllChanged: any;
  canMove: boolean;
  canDelete: boolean;
  moveTo: any;
  deleteItem: any;
  tagFilterOptions: any[];
  onStarredFilterChange: any;
  onTagFilterChange: any;
  selectedTagFilter: string;
  selectedStarredFilter: string;
}

const starredFilterOptions = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

export const SearchResultsFilter: FC<Props> = ({
  allChecked,
  onSelectAllChanged,
  canMove,
  canDelete,
  moveTo,
  deleteItem,
  tagFilterOptions,
  onStarredFilterChange,
  selectedTagFilter,
  onTagFilterChange,
  selectedStarredFilter,
}) => {
  const showActions = canDelete || canMove;
  return (
    <div className="search-results-filter-row">
      <Forms.Checkbox value={allChecked} onChange={onSelectAllChanged} />
      <div className="search-results-filter-row__filters">
        {showActions ? (
          <div className="gf-form-button-row">
            <Button disabled={!canMove} onClick={moveTo} icon="fa fa-exchange" variant="secondary">
              Move
            </Button>
            <Button onClick={deleteItem} disabled={!canDelete} icon="fa fa-trash" variant="destructive">
              Delete
            </Button>
          </div>
        ) : (
          <>
            <div
              className={css`
                display: flex;
              `}
            >
              <Forms.Select
                size="sm"
                placeholder="Filter by starred"
                key={selectedStarredFilter}
                options={starredFilterOptions}
                onChange={onStarredFilterChange}
              />

              <Forms.Select
                size="sm"
                placeholder="Filter by tag"
                key={selectedTagFilter}
                options={tagFilterOptions}
                onChange={onTagFilterChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
