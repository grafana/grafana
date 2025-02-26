import { css } from '@emotion/css';
import { Property } from 'csstype';
import React, { useLayoutEffect, useRef, useEffect } from 'react';
import { Column, SortDirection } from 'react-data-grid';

import { Field, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes';
import { Icon } from '../../../Icon/Icon';
import { Filter } from '../Filter/Filter';
import { TableColumnResizeActionCallback, FilterType, TableRow } from '../types';

interface HeaderCellProps {
  column: Column<any>;
  rows: TableRow[];
  field: Field;
  onSort: (columnKey: string, direction: SortDirection, isMultiSort: boolean) => void;
  direction: SortDirection | undefined;
  justifyContent?: Property.JustifyContent;
  filter: any;
  setFilter: (value: any) => void;
  filterable: boolean;
  onColumnResize?: TableColumnResizeActionCallback;
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  crossFilterOrder: React.MutableRefObject<string[]>;
  crossFilterRows: React.MutableRefObject<{ [key: string]: TableRow[] }>;
}

const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  rows,
  field,
  onSort,
  direction,
  justifyContent,
  filter,
  setFilter,
  filterable,
  onColumnResize,
  headerCellRefs,
  crossFilterOrder,
  crossFilterRows,
}) => {
  const styles = useStyles2(getStyles);
  const headerRef = useRef<HTMLDivElement>(null);

  let isColumnFilterable = filterable;
  if (field.config.custom?.filterable !== filterable) {
    isColumnFilterable = field.config.custom?.filterable || false;
  }
  // we have to remove/reset the filter if the column is not filterable
  if (!isColumnFilterable && filter[field.name]) {
    setFilter((filter: FilterType) => {
      const newFilter = { ...filter };
      delete newFilter[field.name];
      return newFilter;
    });
  }

  const handleSort = (event: React.MouseEvent<HTMLButtonElement>) => {
    const isMultiSort = event.shiftKey;
    onSort(column.key as string, direction === 'ASC' ? 'DESC' : 'ASC', isMultiSort);
  };

  // collecting header cell refs to handle manual column resize
  useLayoutEffect(() => {
    if (headerRef.current) {
      headerCellRefs.current[column.key] = headerRef.current;
    }
  }, [headerRef, column.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // TODO: this is a workaround to handle manual column resize;
  useEffect(() => {
    const headerCellParent = headerRef.current?.parentElement;
    if (headerCellParent) {
      // `lastElement` is an HTML element added by react-data-grid for resizing columns.
      // We add a click event listener to `lastElement` to handle the end of the resize operation.
      const lastElement = headerCellParent.lastElementChild;
      if (lastElement) {
        const handleMouseUp = () => {
          let newWidth = headerCellParent.clientWidth;
          const columnMinWidth = column.minWidth;
          if (columnMinWidth && newWidth < columnMinWidth) {
            newWidth = columnMinWidth;
          }
          onColumnResize?.(column.key as string, newWidth);
        };

        lastElement.addEventListener('click', handleMouseUp);

        return () => {
          lastElement.removeEventListener('click', handleMouseUp);
        };
      }
    }
    // to handle "Not all code paths return a value." error
    return;
  }, [column]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={headerRef}
      style={{ display: 'flex', justifyContent }}
      // TODO find a better solution to this issue, see: https://github.com/adazzle/react-data-grid/issues/3535
      // Unblock spacebar event
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.stopPropagation();
        }
      }}
    >
      <button className={styles.headerCellLabel} onClick={handleSort}>
        <div>{column.name}</div>
        {direction &&
          (direction === 'ASC' ? (
            <Icon name="arrow-up" size="lg" className={styles.sortIcon} />
          ) : (
            <Icon name="arrow-down" size="lg" className={styles.sortIcon} />
          ))}
      </button>

      {isColumnFilterable && (
        <Filter
          name={column.key}
          rows={rows}
          filter={filter}
          setFilter={setFilter}
          field={field}
          crossFilterOrder={crossFilterOrder.current}
          crossFilterRows={crossFilterRows.current}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerCellLabel: css({
    border: 'none',
    padding: 0,
    background: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    alignItems: 'center',
    marginRight: theme.spacing(0.5),

    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
  sortIcon: css({
    marginLeft: theme.spacing(0.5),
  }),
});

export { HeaderCell };
