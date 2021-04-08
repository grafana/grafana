import React, { FC, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { IconButton, useStyles } from '@grafana/ui';

export interface DynamicTableColumnProps<T = any> {
  id: string | number;
  label: string;

  renderRow?: (item: DynamicTableItemProps<T>) => ReactNode;
  size?: number;
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
                <div className={styles.cell} data-column={col.label} key={`${item.id}-${col.id}`}>
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

    return `${col.size}fr`;
  });

  if (isExpandable) {
    sizes.unshift('calc(1em + 16px)');
  }

  return (theme: GrafanaTheme) => ({
    container: css`
      border: 1px solid #464c54;
      border-radius: 2px;
    `,
    row: css`
      color: #9fa7b3;
      display: grid;
      grid-template-columns: ${sizes.join(' ')};

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-template-columns: auto;
      }
    `,
    headerRow: css`
      background-color: #202226;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        display: none;
      }
    `,
    bodyRow: css`
      &:nth-child(2n) {
        background-color: #141619;
      }

      &:nth-child(2n + 1) {
        background-color: #202226;
      }
    `,
    cell: css`
      align-items: center;
      display: grid;
      padding: 8px;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-template-columns: minmax(30px, 30%) 1fr;

        &::before {
          content: attr(data-column);
        }
      }
    `,
    expandCell: css`
      justify-content: center;
      padding: 8px 4px 8px 8px;
    `,
    expandedContentRow: css`
      padding: 8px;
    `,
  });
};
