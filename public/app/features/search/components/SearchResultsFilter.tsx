import React, { FC } from 'react';
import { css } from 'emotion';
import { Button, Forms, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

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
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      <Forms.Checkbox value={allChecked} onChange={onSelectAllChanged} />
      <div className={styles.row}>
        {showActions ? (
          <div className={styles.row}>
            <Button disabled={!canMove} onClick={moveTo} icon="fa fa-exchange" variant="secondary">
              Move
            </Button>
            <Button onClick={deleteItem} disabled={!canDelete} icon="fa fa-trash" variant="destructive">
              Delete
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.row}>
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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      height: 35px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      label {
        height: 20px;
        margin-left: 4px;
      }
    `,
    row: css`
      display: flex;

      & > button:first-child {
        margin-right: ${theme.spacing.md};
      }
    `,
  };
});
