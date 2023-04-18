import { css, cx } from '@emotion/css';
import React, { ReactNode, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, Pagination, useStyles2 } from '@grafana/ui';

import { usePagination } from '../hooks/usePagination';
import { getPaginationStyles } from '../styles/pagination';

interface DynamicTablePagination {
  itemsPerPage: number;
}

export interface DynamicTableColumnProps<T = unknown> {
  id: string | number;
  label: string;

  renderCell: (item: DynamicTableItemProps<T>, index: number) => ReactNode;
  size?: number | string;
}

export interface DynamicTableItemProps<T = unknown> {
  id: string | number;
  data: T;
  renderExpandedContent?: () => ReactNode;
}

export interface DynamicTableProps<T = unknown> {
  cols: Array<DynamicTableColumnProps<T>>;
  items: Array<DynamicTableItemProps<T>>;
  dataTestId?: string;

  isExpandable?: boolean;
  pagination?: DynamicTablePagination;
  paginationStyles?: string;

  // provide these to manually control expanded status
  onCollapse?: (item: DynamicTableItemProps<T>) => void;
  onExpand?: (item: DynamicTableItemProps<T>) => void;
  isExpanded?: (item: DynamicTableItemProps<T>) => boolean;

  renderExpandedContent?: (
    item: DynamicTableItemProps<T>,
    index: number,
    items: Array<DynamicTableItemProps<T>>
  ) => ReactNode;
  testIdGenerator?: (item: DynamicTableItemProps<T>, index: number) => string;
  renderPrefixHeader?: () => ReactNode;
  renderPrefixCell?: (
    item: DynamicTableItemProps<T>,
    index: number,
    items: Array<DynamicTableItemProps<T>>
  ) => ReactNode;

  footerRow?: JSX.Element;
}

export const DynamicTable = <T extends object>({
  cols,
  items,
  isExpandable = false,
  onCollapse,
  onExpand,
  isExpanded,
  renderExpandedContent,
  testIdGenerator,
  pagination,
  paginationStyles,
  // render a cell BEFORE expand icon for header/ each row.
  // currently use by RuleList to render guidelines
  renderPrefixCell,
  renderPrefixHeader,
  footerRow,
  dataTestId,
}: DynamicTableProps<T>) => {
  const defaultPaginationStyles = useStyles2(getPaginationStyles);

  if ((onCollapse || onExpand || isExpanded) && !(onCollapse && onExpand && isExpanded)) {
    throw new Error('either all of onCollapse, onExpand, isExpanded must be provided, or none');
  }
  if ((isExpandable || renderExpandedContent) && !(isExpandable && renderExpandedContent)) {
    throw new Error('either both isExpanded and renderExpandedContent must be provided, or neither');
  }
  const styles = useStyles2(getStyles(cols, isExpandable, !!renderPrefixHeader));

  const [expandedIds, setExpandedIds] = useState<Array<DynamicTableItemProps['id']>>([]);

  const toggleExpanded = (item: DynamicTableItemProps<T>) => {
    if (isExpanded && onCollapse && onExpand) {
      isExpanded(item) ? onCollapse(item) : onExpand(item);
    } else {
      setExpandedIds(
        expandedIds.includes(item.id) ? expandedIds.filter((itemId) => itemId !== item.id) : [...expandedIds, item.id]
      );
    }
  };

  const itemsPerPage = pagination?.itemsPerPage ?? items.length;
  const { page, numberOfPages, onPageChange, pageItems } = usePagination(items, 1, itemsPerPage);

  return (
    <>
      <div className={styles.container} data-testid={dataTestId ?? 'dynamic-table'}>
        <div className={styles.row} data-testid="header">
          {renderPrefixHeader && renderPrefixHeader()}
          {isExpandable && <div className={styles.cell} />}
          {cols.map((col) => (
            <div className={styles.cell} key={col.id}>
              {col.label}
            </div>
          ))}
        </div>

        {pageItems.map((item, index) => {
          const isItemExpanded = isExpanded ? isExpanded(item) : expandedIds.includes(item.id);
          return (
            <div
              className={styles.row}
              key={`${item.id}-${index}`}
              data-testid={testIdGenerator?.(item, index) ?? 'row'}
            >
              {renderPrefixCell && renderPrefixCell(item, index, items)}
              {isExpandable && (
                <div className={cx(styles.cell, styles.expandCell)}>
                  <IconButton
                    aria-label={`${isItemExpanded ? 'Collapse' : 'Expand'} row`}
                    size="lg"
                    data-testid="collapse-toggle"
                    className={styles.expandButton}
                    name={isItemExpanded ? 'angle-down' : 'angle-right'}
                    onClick={() => toggleExpanded(item)}
                    type="button"
                  />
                </div>
              )}
              {cols.map((col) => (
                <div className={cx(styles.cell, styles.bodyCell)} data-column={col.label} key={`${item.id}-${col.id}`}>
                  {col.renderCell(item, index)}
                </div>
              ))}
              {isItemExpanded && renderExpandedContent && (
                <div className={styles.expandedContentRow} data-testid="expanded-content">
                  {renderExpandedContent(item, index, items)}
                </div>
              )}
            </div>
          );
        })}
        {footerRow && <div className={cx(styles.row, styles.footerRow)}>{footerRow}</div>}
      </div>
      {pagination && (
        <Pagination
          className={cx(defaultPaginationStyles, paginationStyles)}
          currentPage={page}
          numberOfPages={numberOfPages}
          onNavigate={onPageChange}
          hideWhenSinglePage
        />
      )}
    </>
  );
};

const getStyles = <T extends unknown>(
  cols: Array<DynamicTableColumnProps<T>>,
  isExpandable: boolean,
  hasPrefixCell: boolean
) => {
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

  if (hasPrefixCell) {
    sizes.unshift('0');
  }

  return (theme: GrafanaTheme2) => ({
    container: css`
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
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

        ${hasPrefixCell
          ? `
            & > *:first-child {
              display: none;
            }
          `
          : ''}
      }
    `,
    footerRow: css`
      display: flex;
      padding: ${theme.spacing(1)};
    `,
    cell: css`
      display: flex;
      align-items: center;
      padding: ${theme.spacing(1)};

      ${theme.breakpoints.down('sm')} {
        padding: ${theme.spacing(1)} 0;
        grid-template-columns: 1fr;
      }
    `,
    bodyCell: css`
      overflow: hidden;

      ${theme.breakpoints.down('sm')} {
        grid-column-end: right;
        grid-column-start: right;

        &::before {
          content: attr(data-column);
          display: block;
          color: ${theme.colors.text.primary};
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
      grid-column-start: ${hasPrefixCell ? 3 : 2};
      grid-row: 2;
      padding: 0 ${theme.spacing(3)} 0 ${theme.spacing(1)};
      position: relative;

      ${theme.breakpoints.down('sm')} {
        grid-column-start: 2;
        border-top: 1px solid ${theme.colors.border.strong};
        grid-row: auto;
        padding: ${theme.spacing(1)} 0 0 0;
      }
    `,
    expandButton: css`
      margin-right: 0;
      display: block;
    `,
  });
};
