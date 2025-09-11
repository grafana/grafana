import 'react-data-grid/lib/styles.css';

import { css } from '@emotion/css';
import clsx from 'clsx';
import { ComponentProps, RefObject, useMemo, useState, cloneElement } from 'react';
import {
  Column,
  DataGridHandle,
  DataGrid as RDG,
  RenderCellProps,
  RenderHeaderCellProps,
  SortColumn,
} from 'react-data-grid';

import { colorManipulator, DataFrame, Field, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { CellRenderer } from './CellRenderer';
import { HeaderCellRenderer } from './HeaderCellRenderer';
import { PaginatedDataGrid } from './PaginatedDataGrid';
import { ColumnTypes, TableRow, TableSummaryRow } from './types';
import { applySort, frameToRecords, getColumnTypes } from './utils';

export interface DataGridProps
  extends Omit<ComponentProps<typeof RDG<TableRow, TableSummaryRow>>, 'sortColumns' | 'rows'> {
  /**
   * instead of providing `rows` as you would with a typical react-data-grid, you should provide `data` as a DataFrame
   * to this component, which enables the sorting functionality to work correctly.
   */
  data: DataFrame;
  /**
   * if true, the background color of the grid will be updated to match the theme's body background.
   * (true transparent is not possible in react-data-grid.)
   */
  transparent?: boolean;
  /**
   * if true, hovering over cells will overflow the cell contents over the rest of the table to reveal the full contents.
   */
  hoverOverflow?: boolean;
  /**
   * if set, enables pagination. either an integer for number of rows, or a method which, given the rows in the grid, returns
   * a number of rows (which is useful for dynamic pagination based on the height of the container or other unique situations).
   */
  rowsPerPage?: number | ((rows: TableRow[]) => number);
  /**
   * callback when the page is changed
   */
  onPageChange?: (pageIndex: number) => void;
  /**
   * initial page to show (1-indexed)
   */
  initialPage?: number;
  /**
   * if true, a more compact pagination control will be shown.
   */
  smallPagination?: boolean;
  /**
   * if true, the header row will be hidden.
   */
  hideHeader?: boolean;
  /**
   * sort columns are statefully handled in this component, unlike react-data-grid which makes you handle sorting yourself.
   * You can optionally provide an initial sort state here.
   */
  initialSortColumns?: SortColumn[];
  /**
   * if provided, this method can be used to filter rows based on whatever UX you provide within or around your DataGrid.
   */
  filterRows?: (rows: TableRow[], fields: Field[]) => TableRow[];
  /**
   * a sensible sorting algorithm is provided for you based on the column type, but if you want to provide your own sorting
   * algorithm, you can do so here. It has the same signature as the `applySort` method exported from the utils file.
   */
  sortRows?: (rows: TableRow[], fields: Field[], sortColumns: SortColumn[], columnTypes?: ColumnTypes) => TableRow[];
  /**
   * if you need a ref to the underlying grid, create one using `useRef<DataGridHandle>()` and pass it here.
   */
  gridRef?: RefObject<DataGridHandle>; // NOTE: until React 19, we must use a prop with a name other than "ref" for this.
}

const basicCellRenderer: (field: Field) => Column<TableRow, TableSummaryRow>['renderCell'] = (field: Field) => {
  const renderer = (props: RenderCellProps<TableRow, TableSummaryRow>) => (
    <CellRenderer field={field} value={props.row[props.column.key]} rowIdx={props.row.__index} />
  );
  renderer.displayName = `CellRenderer(${field.name})`;
  return renderer;
};

const basicHeaderCellRenderer: (field: Field) => Column<TableRow, TableSummaryRow>['renderHeaderCell'] = (
  field: Field
) => {
  const renderer = (props: RenderHeaderCellProps<TableRow, TableSummaryRow>) => (
    <HeaderCellRenderer field={field} direction={props.sortDirection} />
  );
  renderer.displayName = `HeaderCellRenderer(${field.name})`;
  return renderer;
};

export function DataGrid({
  className,
  columns: _columns,
  filterRows = (rows) => rows,
  sortRows = applySort,
  data,
  gridRef,
  headerRowClass,
  hideHeader,
  hoverOverflow = false,
  initialSortColumns,
  onSortColumnsChange,
  rowsPerPage,
  onPageChange,
  initialPage,
  smallPagination,
  rowHeight,
  transparent,
  ...props
}: DataGridProps) {
  const styles = useStyles2(getStyles, Boolean(rowsPerPage), transparent, hideHeader, hoverOverflow);
  const rows = useMemo(() => frameToRecords(data), [data]);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(initialSortColumns ?? []);
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);
  const filteredRows = useMemo(() => filterRows(rows, data.fields), [filterRows, rows, data.fields]);
  const sortedRows = useMemo(
    () => sortRows(filteredRows, data.fields, sortColumns, columnTypes),
    [sortRows, filteredRows, data.fields, sortColumns, columnTypes]
  );

  const columns = useMemo(
    () =>
      _columns.map((col) => {
        const field = data.fields.find((f) => f.name === col.name || getFieldDisplayName(f) === col.name);

        // if we couldn't find the matching field, or if this is a group column, just return it as-is
        if (!field || 'children' in col) {
          return col;
        }

        return {
          ...col,
          sortable: typeof col.sortable === 'boolean' ? col.sortable : true,
          cellClass: col.cellClass ?? styles.cell,
          renderCell: col.renderCell ?? basicCellRenderer(field),
          renderHeaderCell: col.renderHeaderCell ?? basicHeaderCellRenderer(field),
        };
      }),
    [_columns, data.fields, styles.cell]
  );

  let content = (
    <RDG<TableRow, TableSummaryRow>
      {...props}
      className={clsx(styles.container, className)}
      headerRowClass={clsx(styles.header, headerRowClass)}
      ref={gridRef}
      rows={sortedRows}
      rowHeight={rowHeight}
      columns={columns}
      sortColumns={sortColumns}
      onSortColumnsChange={(newSortColumns) => {
        setSortColumns(newSortColumns);
        onSortColumnsChange?.(newSortColumns);
      }}
    />
  );

  if (rowsPerPage) {
    const origContent = content;
    content = (
      <PaginatedDataGrid
        rows={sortedRows}
        rowsPerPage={rowsPerPage}
        onPageChange={onPageChange}
        initialPage={initialPage}
        small={smallPagination}
      >
        {(rows) => cloneElement(origContent, { rows })}
      </PaginatedDataGrid>
    );
  }

  return content;
}

const getStyles = (
  theme: GrafanaTheme2,
  enablePagination?: boolean,
  transparent?: boolean,
  hideHeader?: boolean,
  hoverOverflow?: boolean
) => {
  const bgColor = transparent ? theme.colors.background.canvas : theme.colors.background.primary;
  // this needs to be pre-calc'd since the theme colors have alpha and the border color becomes
  // unpredictable for background color cells
  const borderColor = colorManipulator.onBackground(theme.colors.border.weak, bgColor).toHexString();

  return {
    container: css({
      '--rdg-background-color': bgColor,
      '--rdg-header-background-color': bgColor,
      '--rdg-border-color': borderColor,
      '--rdg-color': theme.colors.text.primary,
      '--rdg-summary-border-color': borderColor,
      '--rdg-summary-border-width': '1px',

      '--rdg-selection-color': theme.colors.info.transparent,

      // note: this cannot have any transparency since default cells that
      // overlay/overflow on hover inherit this background and need to occlude cells below
      '--rdg-row-background-color': bgColor,
      '--rdg-row-hover-background-color': transparent
        ? theme.colors.background.primary
        : theme.colors.background.secondary,

      // TODO: magic 32px number is unfortunate. it would be better to have the content
      // flow using flexbox rather than hard-coding this size via a calc
      blockSize: enablePagination ? 'calc(100% - 32px)' : '100%',
      scrollbarWidth: 'thin',
      scrollbarColor: theme.isDark ? '#fff5 #fff1' : '#0005 #0001',

      border: 'none',

      '.rdg-cell': {
        padding: theme.spacing(0.75),

        '&:last-child': {
          borderInlineEnd: 'none',
        },
      },

      // add a box shadow on hover and selection for all body cells
      '& > :not(.rdg-summary-row, .rdg-header-row) > .rdg-cell': {
        '&:hover, &[aria-selected=true]': { boxShadow: theme.shadows.z2 },
        // selected cells should appear below hovered cells.
        '&:hover': { zIndex: theme.zIndex.tooltip - 7 },
        '&[aria-selected=true]': { zIndex: theme.zIndex.tooltip - 6 },
      },

      '.rdg-cell.rdg-cell-frozen': {
        backgroundColor: '--rdg-row-background-color',
        zIndex: theme.zIndex.tooltip - 4,
        '&:hover': { zIndex: theme.zIndex.tooltip - 2 },
        '&[aria-selected=true]': { zIndex: theme.zIndex.tooltip - 3 },
      },

      '.rdg-header-row, .rdg-summary-row': {
        '.rdg-cell': {
          zIndex: theme.zIndex.tooltip - 5,
          '&.rdg-cell-frozen': {
            zIndex: theme.zIndex.tooltip - 1,
          },
        },
      },

      '.rdg-summary-row >': {
        '.rdg-cell': {
          // 0.75 padding causes "jumping" on hover.
          paddingBlock: theme.spacing(0.625),
        },
        '&:hover, &[aria-selected=true]': {
          whiteSpace: 'pre-line',
          height: '100%',
          minHeight: 'fit-content',
          overflowY: 'visible',
          boxShadow: theme.shadows.z2,
        },
      },
    }),
    header: css({
      ...(hideHeader
        ? { display: 'none' }
        : {
            paddingBlockStart: 0,
            fontWeight: 'normal',
            '& .rdg-cell': { height: '100%', alignItems: 'flex-end' },
          }),
    }),
    cell: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...(hoverOverflow && { minHeight: '100%' }),

      '&:hover, &[aria-selected=true]': {
        '.table-cell-actions': { display: 'flex' },
        ...(hoverOverflow && {
          zIndex: theme.zIndex.tooltip - 2,
          height: 'fit-content',
          whiteSpace: 'pre-line',
        }),
      },
    }),
  };
};
