import React, { FC, memo, useMemo } from 'react';
import { DataFrame, Field } from '@grafana/data';
import { Cell, Column, HeaderGroup, useBlockLayout, useSortBy, useTable } from 'react-table';
import { FixedSizeList } from 'react-window';
import useMeasure from 'react-use/lib/useMeasure';
import { getColumns, getTableRows, getTextAlign } from './utils';
import { useTheme } from '../../themes';
import { TableFilterActionCallback } from './types';
import { getTableStyles } from './styles';
import { TableCell } from './TableCell';
import { Icon } from '../Icon/Icon';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';

export interface Props {
  data: DataFrame;
  width: number;
  height: number;
  /** Minimal column width specified in pixels */
  columnMinWidth?: number;
  noHeader?: boolean;
  onCellClick?: TableFilterActionCallback;
}

export const Table: FC<Props> = memo(({ data, height, onCellClick, width, columnMinWidth, noHeader }) => {
  const theme = useTheme();
  const [ref, headerRowMeasurements] = useMeasure();
  const tableStyles = getTableStyles(theme);
  const memoizedColumns = useMemo(() => getColumns(data, width, columnMinWidth ?? 150), [data, width, columnMinWidth]);
  const memoizedData = useMemo(() => getTableRows(data), [data]);

  const { getTableProps, headerGroups, rows, prepareRow } = useTable(
    {
      columns: memoizedColumns,
      data: memoizedData,
    },
    useSortBy,
    useBlockLayout
  );

  const RenderRow = React.useCallback(
    ({ index, style }) => {
      const row = rows[index];
      prepareRow(row);
      return (
        <div {...row.getRowProps({ style })} className={tableStyles.row}>
          {row.cells.map((cell: Cell, index: number) => (
            <TableCell
              key={index}
              field={data.fields[index]}
              tableStyles={tableStyles}
              cell={cell}
              onCellClick={onCellClick}
            />
          ))}
        </div>
      );
    },
    [prepareRow, rows]
  );

  let totalWidth = 0;

  for (const headerGroup of headerGroups) {
    for (const header of headerGroup.headers) {
      totalWidth += header.width as number;
    }
  }

  return (
    <div {...getTableProps()} className={tableStyles.table}>
      <CustomScrollbar hideVerticalTrack={true}>
        {!noHeader && (
          <div>
            {headerGroups.map((headerGroup: HeaderGroup) => (
              <div className={tableStyles.thead} {...headerGroup.getHeaderGroupProps()} ref={ref}>
                {headerGroup.headers.map((column: Column, index: number) =>
                  renderHeaderCell(column, tableStyles.headerCell, data.fields[index])
                )}
              </div>
            ))}
          </div>
        )}
        <FixedSizeList
          height={height - headerRowMeasurements.height}
          itemCount={rows.length}
          itemSize={tableStyles.rowHeight}
          width={totalWidth ?? width}
          style={{ overflow: 'hidden auto' }}
        >
          {RenderRow}
        </FixedSizeList>
      </CustomScrollbar>
    </div>
  );
});

function renderHeaderCell(column: any, className: string, field?: Field) {
  const headerProps = column.getHeaderProps(column.getSortByToggleProps());
  headerProps.style.textAlign = getTextAlign(field);

  return (
    <div className={className} {...headerProps}>
      {column.render('Header')}
      {column.isSorted && (column.isSortedDesc ? <Icon name="caret-down" /> : <Icon name="caret-up" />)}
    </div>
  );
}
