import React, { forwardRef, PropsWithChildren, ReactNode, useImperativeHandle, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { config } from '@grafana/runtime';
import { IconButton, stylesFactory } from '@grafana/ui';

const getStyles = stylesFactory((theme: GrafanaTheme, cols: DynamicTableColumnProps[]) => {
  const sizes = cols
    .map((col) => {
      if (col.type === 'expand') {
        return 'calc(1em + 16px)';
      }

      if (!col.size) {
        return 'auto';
      }

      return `${col.size}fr`;
    })
    .join(' ');

  return {
    container: css`
      border: 1px solid #464c54;
      border-radius: 2px;
    `,
    row: css`
      color: #9fa7b3;
      display: grid;
      grid-template-columns: ${sizes};

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
  };
});

export interface DynamicTableColumnProps<T = any> {
  label: string;
  type: 'expand' | 'data';

  render?: (item: T, itemKey: string, isExpanded: boolean, isAlternateContent: boolean) => ReactNode;
  size?: number;
}

export interface DynamicTableRef {
  addAlternateExpandedContentItem: (itemKey: string) => void;
  removeAlternateExpandedContentItem: (itemKey: string) => void;
}

export interface DynamicTableProps<T = any> {
  cols: Array<DynamicTableColumnProps<T>>;
  items: T[];

  renderExpandedItem?: (item: T, itemKey: string) => ReactNode;
  renderAlternateExpandedItem?: (item: T, itemKey: string) => ReactNode;
}

export const DynamicTable = forwardRef<DynamicTableRef, PropsWithChildren<DynamicTableProps>>(
  ({ cols, items, renderExpandedItem, renderAlternateExpandedItem }, ref) => {
    const styles = getStyles(config.theme, cols);
    const [expandedItems, setExpandedItems] = useState<string[]>([]);
    const [alternateExpandedContentItems, setAlternateExpandedContentItems] = useState<string[]>([]);

    const addExpandedItem = (itemKey: string) => {
      setExpandedItems([...expandedItems, itemKey]);
    };

    const removeExpandedItem = (itemKey: string) => {
      const newItems = [...expandedItems];
      const itemIndex = newItems.indexOf(itemKey);
      newItems.splice(itemIndex, 1);
      setExpandedItems(newItems);
    };

    const toggleExpandedItems = (itemKey: string) => {
      if (expandedItems.includes(itemKey)) {
        removeExpandedItem(itemKey);
      } else {
        addExpandedItem(itemKey);
      }
    };

    const addAlternateExpandedContentItem = (itemKey: string) => {
      setAlternateExpandedContentItems([...alternateExpandedContentItems, itemKey]);
    };

    const removeAlternateExpandedContentItem = (itemKey: string) => {
      const newItems = [...alternateExpandedContentItems];
      const itemIndex = newItems.indexOf(itemKey);
      newItems.splice(itemIndex, 1);
      setAlternateExpandedContentItems(newItems);
    };

    useImperativeHandle(ref, () => ({
      addAlternateExpandedContentItem: (itemKey) => {
        if (!alternateExpandedContentItems.includes(itemKey)) {
          addAlternateExpandedContentItem(itemKey);
        }

        if (!expandedItems.includes(itemKey)) {
          addExpandedItem(itemKey);
        }
      },

      removeAlternateExpandedContentItem: (itemKey) => {
        if (alternateExpandedContentItems.includes(itemKey)) {
          removeAlternateExpandedContentItem(itemKey);
        }

        if (!expandedItems.includes(itemKey)) {
          removeExpandedItem(itemKey);
        }
      },
    }));

    return (
      <div className={styles.container}>
        <div className={cx(styles.row, styles.headerRow)}>
          {cols.map((col, colIndex) => {
            return (
              <div className={styles.cell} key={`c${colIndex}`}>
                {col.label ?? ' '}
              </div>
            );
          })}
        </div>
        {items.map((item, itemIndex) => {
          const itemKey = `i${itemIndex}`;
          const isExpanded = expandedItems.includes(itemKey);
          const isAlternateContent = alternateExpandedContentItems.includes(itemKey);

          return (
            <div className={styles.bodyRow} key={`i${itemIndex}`}>
              <div className={styles.row}>
                {cols.map((col, colIndex) => {
                  const cellKey = `${itemKey}c${colIndex}`;

                  return (
                    <div
                      className={cx({
                        [styles.cell]: true,
                        [styles.expandCell]: col.type === 'expand',
                      })}
                      data-column={col.label}
                      key={cellKey}
                    >
                      {col.type === 'expand' ? (
                        <IconButton
                          name={isExpanded ? 'angle-down' : 'angle-right'}
                          onClick={() => toggleExpandedItems(itemKey)}
                        />
                      ) : (
                        col.render?.(item, itemKey, isExpanded, isAlternateContent)
                      )}
                    </div>
                  );
                })}
              </div>
              {isExpanded && (
                <div className={styles.expandedContentRow}>
                  {isAlternateContent
                    ? renderAlternateExpandedItem!(item, itemKey)
                    : renderExpandedItem!(item, itemKey)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

DynamicTable.displayName = 'DynamicTable';
