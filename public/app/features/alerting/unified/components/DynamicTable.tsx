import React, { FC, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { IconButton, useStyles, useTheme } from '@grafana/ui';
import { useMedia } from 'react-use';

export interface DynamicTableColumnProps<T = unknown> {
  id: string | number;
  label: string;

  renderRow?: (item: DynamicTableItemProps<T>, index: number) => ReactNode;
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
  renderExpandedContent?: (item: DynamicTableItemProps, index: number) => ReactNode;
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
  const theme = useTheme();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.sm})`);

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
        <div className={styles.row} key={item.id}>
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
              {col.renderRow?.(item, index)}
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
      border: 1px solid ${theme.colors.border3};
      border-radius: 2px;
    `,
    row: css`
      display: grid;
      grid-template-columns: ${sizes.join(' ')};
      grid-template-rows: 1fr auto;

      &:nth-child(2n + 1) {
        background-color: ${theme.isLight ? theme.colors.bodyBg : theme.colors.panelBg};
      }

      &:nth-child(2n) {
        background-color: ${theme.isLight ? theme.colors.panelBg : theme.colors.bodyBg};
      }

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-template-columns: auto 1fr;
        grid-template-areas: 'left right';
        padding: 0 ${theme.spacing.xs};

        &:first-child {
          display: none;
        }
      }
    `,
    cell: css`
      align-items: center;
      display: grid;
      padding: ${theme.spacing.sm};

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        padding: ${theme.spacing.sm} 0;
        grid-template-columns: 1fr;
      }
    `,
    bodyCell: css`
      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        grid-column-end: right;
        grid-column-start: right;

        &::before {
          content: attr(data-column);
        }
      }
    `,
    expandCell: css`
      justify-content: center;

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        align-items: start;
        grid-area: left;
      }
    `,
    expandedContentRow: css`
      grid-column-end: ${sizes.length + 1};
      grid-column-start: 2;
      grid-row: 2;
      padding: 0 ${theme.spacing.lg} 0 ${theme.spacing.sm};

      @media only screen and (max-width: ${theme.breakpoints.sm}) {
        border-top: 1px solid ${theme.colors.border3};
        grid-row: auto;
        padding: ${theme.spacing.sm} 0 0 0;
      }
    `,
    expandButton: css`
      margin-right: 0;
    `,
  });
};
