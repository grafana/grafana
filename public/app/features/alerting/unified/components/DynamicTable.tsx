import React, { FC, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { IconButton, useStyles } from '@grafana/ui';

export interface DynamicTableColumnProps<T = any> {
  id: string | number;
  label: string;

  renderRow?: (item: DynamicTableItemProps<T>) => ReactNode;
  size?: number | string;
}

export interface DynamicTableItemProps<T = any> {
  id: string | number;
  data: T;

  renderExpandedContent?: () => ReactNode;
  isExpanded?: boolean;
}

export interface DynamicTableProps<T = any> {
  cols: Array<DynamicTableColumnProps<T>>;
  items: Array<DynamicTableItemProps<T>>;

  isExpandable?: boolean;
  onCollapse?: (id: DynamicTableItemProps<T>) => void;
  onExpand?: (id: DynamicTableItemProps<T>) => void;
  renderExpandedContent?: (item: DynamicTableItemProps) => ReactNode;
}

export const DynamicTable: FC<DynamicTableProps> = ({
  cols,
  items,
  isExpandable = false,
  onCollapse,
  onExpand,
  renderExpandedContent,
}) => {
  const styles = useStyles(getStyles(cols, isExpandable));

  return (
    <div className={styles.container}>
      <div className={cx(styles.row, styles.headerRow)}>
        {isExpandable && <div className={styles.cell} />}
        {cols.map((col) => (
          <div className={styles.cell} key={col.id}>
            {col.label}
          </div>
        ))}
      </div>

      {items.map((item) => {
        return (
          <div className={styles.bodyRow} key={item.id}>
            <div className={styles.row}>
              {isExpandable && (
                <div className={cx(styles.cell, styles.expandCell)}>
                  <IconButton
                    name={item.isExpanded ? 'angle-down' : 'angle-right'}
                    onClick={() => (item.isExpanded ? onCollapse?.(item) : onExpand?.(item))}
                  />
                </div>
              )}
              {cols.map((col) => (
                <div className={cx(styles.cell, styles.bodyCell)} data-column={col.label} key={`${item.id}-${col.id}`}>
                  {col.renderRow?.(item)}
                </div>
              ))}
            </div>
            {item.isExpanded && (
              <div className={styles.expandedContentRow}>
                {item.renderExpandedContent ? item.renderExpandedContent() : renderExpandedContent?.(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const getStyles = (cols: DynamicTableColumnProps[], isExpandable: boolean) => {
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

  return (theme: GrafanaTheme) => ({
    container: css`
      background-color: ${theme.colors.bg2};
      border: 1px solid ${theme.colors.border3};
      border-radius: 2px;
    `,
    row: css`
      display: grid;
      grid-template-columns: ${sizes.join(' ')};

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-template-columns: auto 1fr;
        grid-template-areas: 'left right';
      }
    `,
    headerRow: css`
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        display: none;
      }
    `,
    bodyRow: css`
      &:nth-child(2n) {
        background-color: ${theme.colors.bodyBg};
      }
    `,
    cell: css`
      align-items: center;
      display: grid;
      padding: ${theme.spacing.sm};
    `,
    bodyCell: css`
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-column-end: right;
        grid-column-start: right;
        grid-template-columns: minmax(30px, 30%) 1fr;

        &::before {
          content: attr(data-column);
        }
      }
    `,
    expandCell: css`
      justify-content: center;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-area: left;
        grid-template-columns: 1fr;
      }
    `,
    expandedContentRow: css`
      padding: ${theme.spacing.sm};
    `,
  });
};
