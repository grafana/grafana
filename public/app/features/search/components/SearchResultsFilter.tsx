import React, { FC, FormEvent } from 'react';
import { css } from '@emotion/css';
import { Button, Checkbox, stylesFactory, useTheme, HorizontalGroup } from '@grafana/ui';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { DashboardQuery, SearchLayout } from '../types';
import { ActionRow } from './ActionRow';

export interface Props {
  allChecked?: boolean;
  canDelete?: boolean;
  canMove?: boolean;
  deleteItem: () => void;
  hideLayout?: boolean;
  moveTo: () => void;
  onLayoutChange: (layout: SearchLayout) => void;
  onSortChange: (value: SelectableValue) => void;
  onStarredFilterChange: (event: FormEvent<HTMLInputElement>) => void;
  onTagFilterChange: (tags: string[]) => void;
  onToggleAllChecked: () => void;
  query: DashboardQuery;
  editable?: boolean;
}

export const SearchResultsFilter: FC<Props> = ({
  allChecked,
  canDelete,
  canMove,
  deleteItem,
  hideLayout,
  moveTo,
  onLayoutChange,
  onSortChange,
  onStarredFilterChange,
  onTagFilterChange,
  onToggleAllChecked,
  query,
  editable,
}) => {
  const showActions = canDelete || canMove;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.wrapper}>
      {editable && (
        <div className={styles.checkboxWrapper}>
          <Checkbox aria-label="Select all" value={allChecked} onChange={onToggleAllChecked} />
        </div>
      )}
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
        <ActionRow
          {...{
            hideLayout,
            onLayoutChange,
            onSortChange,
            onStarredFilterChange,
            onTagFilterChange,
            query,
          }}
          showStarredFilter
        />
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const { sm, md } = theme.spacing;
  return {
    wrapper: css`
      height: ${theme.height.md}px;
      display: flex;
      justify-content: flex-start;
      gap: ${theme.spacing.md};
      align-items: center;
      margin-bottom: ${sm};

      > label {
        height: 20px;
        margin: 0 ${md} 0 ${sm};
      }
    `,
    checkboxWrapper: css`
      label {
        line-height: 1.2;
        width: max-content;
      }
    `,
  };
});
