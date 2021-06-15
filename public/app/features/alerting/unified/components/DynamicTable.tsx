import React, { ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { useMedia } from 'react-use';

export interface DynamicTableColumnProps<T = unknown> {
  id: string | number;
  label: string;

  renderCell?: (item: DynamicTableItemProps<T>, index: number) => ReactNode;
  size?: number | string;
}

export interface DynamicTableItemProps<T = unknown> {
  id: string | number;
  data: T;

  renderExpandedContent?: () => ReactNode;
  isExpanded?: boolean;
}

export interface DynamicTableProps<T = unknown> {
  cols: Array<DynamicTableColumnProps<T>>;
  items: Array<DynamicTableItemProps<T>>;

  isExpandable?: boolean;
  onCollapse?: (id: DynamicTableItemProps<T>) => void;
  onExpand?: (id: DynamicTableItemProps<T>) => void;
  renderExpandedContent?: (item: DynamicTableItemProps<T>, index: number) => ReactNode;
  testIdGenerator?: (item: DynamicTableItemProps<T>) => string;
}

export const DynamicTable = <T extends object>({
  cols,
  items,
  isExpandable = false,
  onCollapse,
  onExpand,
  renderExpandedContent,
  testIdGenerator,
}: DynamicTableProps<T>) => {
  const styles = useStyles2(getStyles(cols, isExpandable));
  const theme = useTheme2();
  const isMobile = useMedia(`(${theme.breakpoints.down('sm')})`);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        {isExpandable && <div className={styles.cell} />}
        {cols.map((col) => (
          <div className={styles.cell} key={col.id}>
            {col.label}
          </div>
        ))}
      </div>

      {items.map((item, index) => (
        <div className={styles.row} key={item.id} data-testid={testIdGenerator?.(item)}>
          {isExpandable && (
            <div className={cx(styles.cell, styles.expandCell)}>
              <IconButton
                size={isMobile ? 'xl' : 'md'}
                className={styles.expandButton}
                name={item.isExpanded ? 'angle-down' : 'angle-right'}
                onClick={() => (item.isExpanded ? onCollapse?.(item) : onExpand?.(item))}
                type="button"
              />
            </div>
          )}
          {cols.map((col) => (
            <div className={cx(styles.cell, styles.bodyCell)} data-column={col.label} key={`${item.id}-${col.id}`}>
              {col.renderCell?.(item, index)}
            </div>
          ))}
          {item.isExpanded && (
            <div className={styles.expandedContentRow}>
              {item.renderExpandedContent ? item.renderExpandedContent() : renderExpandedContent?.(item, index)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const getStyles = <T extends unknown>(cols: Array<DynamicTableColumnProps<T>>, isExpandable: boolean) => {
  const sizes = cols.map((col) => {
    if (!col.size) {
      return 'auto';
    }

    if (typeof col.size === 'number') {
      return `${col.size}fr`;
    }

    return col.size;
  });

  if (isExpandable) {
    sizes.unshift('calc(1em + 16px)');
  }

  return (theme: GrafanaTheme2) => ({
    container: css`
      border: 1px solid ${theme.colors.border.strong};
      border-radius: 2px;
      color: ${theme.colors.text.secondary};
    `,
    row: css`
      display: grid;
      grid-template-columns: ${sizes.join(' ')};
      grid-template-rows: 1fr auto;

      &:nth-child(2n + 1) {
        background-color: ${theme.colors.background.secondary};
      }

      &:nth-child(2n) {
        background-color: ${theme.colors.background.primary};
      }

      ${theme.breakpoints.down('sm')} {
        grid-template-columns: auto 1fr;
        grid-template-areas: 'left right';
        padding: 0 ${theme.spacing(0.5)};

        &:first-child {
          display: none;
        }
      }
    `,
    cell: css`
      align-items: center;
      display: grid;
      padding: ${theme.spacing(1)};

      ${theme.breakpoints.down('sm')} {
        padding: ${theme.spacing(1)} 0;
        grid-template-columns: 1fr;
      }
    `,
    bodyCell: css`
      ${theme.breakpoints.down('sm')} {
        grid-column-end: right;
        grid-column-start: right;

        &::before {
          content: attr(data-column);
        }
      }
    `,
    expandCell: css`
      justify-content: center;

      ${theme.breakpoints.down('sm')} {
        align-items: start;
        grid-area: left;
      }
    `,
    expandedContentRow: css`
      grid-column-end: ${sizes.length + 1};
      grid-column-start: 2;
      grid-row: 2;
      padding: 0 ${theme.spacing(3)} 0 ${theme.spacing(1)};

      ${theme.breakpoints.down('sm')} {
        border-top: 1px solid ${theme.colors.border.strong};
        grid-row: auto;
        padding: ${theme.spacing(1)} 0 0 0;
      }
    `,
    expandButton: css`
      margin-right: 0;
    `,
  });
};
