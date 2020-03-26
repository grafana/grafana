import React, { FC } from 'react';
//import { css, cx } from 'emotion';
import { Button, Forms } from '@grafana/ui';
import { SearchCheckbox } from './SearchCheckbox';

interface Props {
  allChecked: boolean;
  onSelectAllChanged: any;
  canMove: boolean;
  canDelete: boolean;
  moveTo: any;
  deleteItem: any;
  starredFilterOptions: any[];
  tagFilterOptions: any[];
  selectedStarredFilter: any;
  onStarredFilterChange: any;
  selectedTagFilter: any;
  onTagFilterChange: any;
}

export const SearchResultsFilter: FC<Props> = ({
  allChecked,
  onSelectAllChanged,
  canMove,
  canDelete,
  moveTo,
  deleteItem,
  starredFilterOptions,
  tagFilterOptions,
  selectedStarredFilter,
  onStarredFilterChange,
  selectedTagFilter,
  onTagFilterChange,
}) => {
  const showActions = canDelete || canMove;
  return (
    <div className="search-results-filter-row">
      <SearchCheckbox checked={allChecked} onClick={onSelectAllChanged} editable={true} />
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
            <div className="gf-form-select-wrapper">
              <Forms.Select
                size="sm"
                value={selectedStarredFilter}
                options={starredFilterOptions}
                onChange={onStarredFilterChange}
              />
            </div>
            <div className="gf-form-select-wrapper">
              <Forms.Select
                size="sm"
                value={selectedTagFilter}
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
