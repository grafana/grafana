import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { SortByFn, useSortBy, useAbsoluteLayout, useTable, CellProps } from 'react-table';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, CustomScrollbar } from '@grafana/ui';

import { TOP_TABLE_COLUMN_WIDTH } from '../../constants';
import { ColumnTypes, TopTableData, TopTableValue } from '../types';

type Props = {
  width: number;
  height: number;
  data: TopTableData[];
  search: string;
  setSearch: (search: string) => void;
  setTopLevelIndex: (level: number) => void;
  setRangeMin: (range: number) => void;
  setRangeMax: (range: number) => void;
};

const FlameGraphTopTable = ({
  width,
  height,
  data,
  search,
  setSearch,
  setTopLevelIndex,
  setRangeMin,
  setRangeMax,
}: Props) => {
  const styles = useStyles2((theme) => getStyles(theme));

  const sortSymbols: SortByFn<object> = (a, b, column) => {
    return a.values[column].localeCompare(b.values[column]);
  };

  const sortUnits: SortByFn<object> = (a, b, column) => {
    return a.values[column].value.toString().localeCompare(b.values[column].value.toString(), 'en', { numeric: true });
  };

  const columns = useMemo(
    () => [
      {
        accessor: ColumnTypes.Symbol.toLowerCase(),
        header: ColumnTypes.Symbol,
        cell: SymbolCell,
        sortType: sortSymbols,
        width: width - TOP_TABLE_COLUMN_WIDTH * 2,
      },
      {
        accessor: ColumnTypes.Self.toLowerCase(),
        header: ColumnTypes.Self,
        cell: UnitCell,
        sortType: sortUnits,
        width: TOP_TABLE_COLUMN_WIDTH,
      },
      {
        accessor: ColumnTypes.Total.toLowerCase(),
        header: ColumnTypes.Total,
        cell: UnitCell,
        sortType: sortUnits,
        width: TOP_TABLE_COLUMN_WIDTH,
      },
    ],
    [width]
  );

  const options = useMemo(
    () => ({
      columns,
      data,
      initialState: {
        sortBy: [
          {
            id: ColumnTypes.Self.toLowerCase(),
            desc: true,
          },
        ],
      },
    }),
    [columns, data]
  );

  const rowClicked = useCallback(
    (row: string) => {
      if (search === row) {
        setSearch('');
      } else {
        setSearch(row);
        // Reset selected level in flamegraph when selecting row in top table
        setTopLevelIndex(0);
        setRangeMin(0);
        setRangeMax(1);
      }
    },
    [search, setRangeMax, setRangeMin, setSearch, setTopLevelIndex]
  );

  const { headerGroups, rows, prepareRow } = useTable(options, useSortBy, useAbsoluteLayout);

  const renderRow = React.useCallback(
    ({ index, style }) => {
      let row = rows[index];
      prepareRow(row);

      const rowValue = row.values[ColumnTypes.Symbol.toLowerCase()];
      const classNames = cx(rowValue === search && styles.matchedRow, styles.row);

      return (
        <div
          {...row.getRowProps({ style })}
          className={classNames}
          onClick={() => {
            rowClicked(rowValue);
          }}
        >
          {row.cells.map((cell) => {
            const { key, ...cellProps } = cell.getCellProps();
            if (cellProps.style) {
              cellProps.style.minWidth = cellProps.style.width;
            }
            return (
              <div key={key} className={styles.cell} {...cellProps}>
                {cell.render('cell')}
              </div>
            );
          })}
        </div>
      );
    },
    [rows, prepareRow, search, styles.matchedRow, styles.row, styles.cell, rowClicked]
  );

  return (
    <div className={styles.table(height)} data-testid="topTable">
      {headerGroups.map((headerGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps();

        return (
          <div key={key} className={styles.header} {...headerGroupProps}>
            {headerGroup.headers.map((column) => {
              const { key, ...headerProps } = column.getHeaderProps(
                column.canSort ? column.getSortByToggleProps() : undefined
              );

              return (
                <div key={key} className={styles.headerCell} {...headerProps}>
                  {column.render('header')}
                  {column.isSorted && <Icon name={column.isSortedDesc ? 'arrow-down' : 'arrow-up'} />}
                </div>
              );
            })}
          </div>
        );
      })}

      {rows.length > 0 ? (
        <CustomScrollbar hideVerticalTrack={true}>
          <FixedSizeList
            height={height}
            itemCount={rows.length}
            itemSize={38}
            width={'100%'}
            style={{ overflow: 'hidden auto' }}
          >
            {renderRow}
          </FixedSizeList>
        </CustomScrollbar>
      ) : (
        <div style={{ height: height }} className={styles.noData}>
          No data
        </div>
      )}
    </div>
  );
};

const SymbolCell = ({ cell: { value } }: CellProps<TopTableValue, TopTableValue>) => {
  return <div>{value}</div>;
};

const UnitCell = ({ cell: { value } }: CellProps<TopTableValue, TopTableValue>) => {
  return <div>{value.unitValue}</div>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  table: (height: number) => {
    return css`
      background-color: ${theme.colors.background.primary};
      height: ${height}px;
      overflow: scroll;
      display: flex;
      flex-direction: column;
      width: 100%;
    `;
  },
  header: css`
    height: 38px;

    & > :nth-child(2),
    & > :nth-child(3) {
      text-align: right;
    }

    // needed to keep header row height fixed so header row does not resize with browser
    & > :nth-child(3) {
      position: relative !important;
    }
  `,
  headerCell: css`
    background-color: ${theme.colors.background.secondary};
    color: ${theme.colors.primary.text};
    padding: ${theme.spacing(1)};
  `,
  matchedRow: css`
    & > :nth-child(1),
    & > :nth-child(2),
    & > :nth-child(3) {
      background-color: ${theme.colors.background.secondary} !important;
    }
  `,
  row: css`
    border-top: 1px solid ${theme.components.panel.borderColor};

    &:hover {
      background-color: ${theme.colors.emphasize(theme.colors.background.primary, 0.03)};
    }
    & > :nth-child(2),
    & > :nth-child(3) {
      text-align: right;
    }
    & > :nth-child(3) {
      border-right: none;
    }
  `,
  cell: css`
    border-right: 1px solid ${theme.components.panel.borderColor};
    padding: ${theme.spacing(1)};

    div {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    &:hover {
      overflow: visible;
      width: auto !important;
      box-shadow: 0 0 2px ${theme.colors.primary.main};
      background-color: ${theme.colors.emphasize(theme.colors.background.primary, 0.03)};
      z-index: 1;
    }
  `,
  noData: css`
    align-items: center;
    display: flex;
    justify-content: center;
  `,
});

export default FlameGraphTopTable;
