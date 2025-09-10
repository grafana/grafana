import 'react-data-grid/lib/styles.css';

import { css } from '@emotion/css';
import clsx from 'clsx';
import { ComponentProps, ReactNode, RefObject, useMemo, useState, cloneElement, useLayoutEffect } from 'react';
import { DataGridHandle, DataGrid as RDG, SortColumn } from 'react-data-grid';

import { colorManipulator, DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Pagination } from '../Pagination/Pagination';

import { ColumnTypes, TableRow, TableSummaryRow } from './types';
import { applySort, frameToRecords, getColumnTypes } from './utils';

export interface DataGridPaginationProps {
  rows: TableRow[];
  children: (rows: TableRow[]) => ReactNode;
  rowsPerPage: number | ((rows: TableRow[]) => number);
  onPageChange?: (pageIndex: number) => void;
  initialPage?: number;
  small?: boolean;
}

const PaginatedDataGrid = ({
  children,
  rows,
  rowsPerPage: _rowsPerPage,
  onPageChange,
  initialPage = 1,
  small,
}: DataGridPaginationProps) => {
  const styles = useStyles2(getPaginationStyles);
  const [page, setPage] = useState(initialPage);
  const rowsPerPage = useMemo(
    () => (typeof _rowsPerPage === 'function' ? _rowsPerPage(rows) : _rowsPerPage),
    [_rowsPerPage, rows]
  );
  const numRows = rows.length;
  const numPages = Math.ceil(numRows / rowsPerPage);
  const pageRangeStart = (page - 1) * rowsPerPage + 1;
  let pageRangeEnd = pageRangeStart + rowsPerPage - 1;
  if (pageRangeEnd > numRows) {
    pageRangeEnd = numRows;
  }
  const paginatedRows = useMemo(() => {
    const pageOffset = pageRangeStart - 1;
    return rows.slice(pageOffset, pageOffset + rowsPerPage);
  }, [pageRangeStart, rows, rowsPerPage]);

  // safeguard against page overflow on panel resize or other factors
  useLayoutEffect(() => {
    if (page > numPages) {
      // resets pagination to end
      setPage(numPages);
    }
  }, [numPages, page, setPage]);

  return (
    <>
      {children(paginatedRows)}
      <div className={styles.container}>
        <Pagination
          className="table-ng-pagination"
          currentPage={page}
          numberOfPages={numPages}
          showSmallVersion={small}
          onNavigate={(toPage) => {
            onPageChange?.(toPage);
            setPage(toPage);
          }}
        />
        {!small && (
          <div className={styles.summary}>
            <Trans i18nKey="grafana-ui.data-grid.pagination-summary">
              {{ pageRangeStart }} - {{ pageRangeEnd }} of {{ numRows }} rows
            </Trans>
          </div>
        )}
      </div>
    </>
  );
};

export interface DataGridProps<TableRow, TableSummaryRow>
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
   * if this object is set, pagination will be enabled for the grid.
   */
  pagination?: {
    /**
     * either an integer for number of rows, or a method which, given the rows in the grid, returns a number of rows
     * (which is useful for dynamic pagination based on the height of the container or other unique situations).
     */
    rowsPerPage: DataGridPaginationProps['rowsPerPage'];
    /**
     * callback when the page is changed
     */
    onPageChange?: DataGridPaginationProps['onPageChange'];
    /**
     * initial page to show (1-indexed)
     */
    initialPage?: DataGridPaginationProps['initialPage'];
    /**
     * if true, a more compact pagination control will be shown.
     */
    small?: DataGridPaginationProps['small'];
  };
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

export function DataGrid({
  className,
  filterRows = (rows) => rows,
  sortRows = applySort,
  data,
  gridRef,
  headerRowClass,
  hideHeader,
  initialSortColumns,
  onSortColumnsChange,
  pagination,
  rowHeight,
  transparent,
  ...props
}: DataGridProps<TableRow, TableSummaryRow>) {
  const styles = useStyles2(getStyles, Boolean(pagination), transparent, hideHeader);
  const rows = useMemo(() => frameToRecords(data), [data]);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>(initialSortColumns ?? []);
  const columnTypes = useMemo(() => getColumnTypes(data.fields), [data.fields]);
  const filteredRows = useMemo(() => filterRows(rows, data.fields), [filterRows, rows, data.fields]);
  const sortedRows = useMemo(
    () => sortRows(filteredRows, data.fields, sortColumns, columnTypes),
    [sortRows, filteredRows, data.fields, sortColumns, columnTypes]
  );

  let content = (
    <RDG<TableRow, TableSummaryRow>
      {...props}
      className={clsx(styles.container, className)}
      headerRowClass={clsx(styles.header, headerRowClass)}
      ref={gridRef}
      rows={sortedRows}
      sortColumns={sortColumns}
      rowHeight={rowHeight}
      onSortColumnsChange={(newSortColumns) => {
        setSortColumns(newSortColumns);
        onSortColumnsChange?.(newSortColumns);
      }}
    />
  );

  if (pagination) {
    const origContent = content;
    content = (
      <PaginatedDataGrid {...pagination} rows={sortedRows}>
        {(rows) => cloneElement(origContent, { rows })}
      </PaginatedDataGrid>
    );
  }

  return content;
}

const getStyles = (theme: GrafanaTheme2, enablePagination?: boolean, transparent?: boolean, hideHeader?: boolean) => {
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
  };
};

const getPaginationStyles = (theme: GrafanaTheme2) => ({
  container: css({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    width: '100%',
  }),
  summary: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1, 0, 2),
  }),
});
