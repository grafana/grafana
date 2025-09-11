import { css } from '@emotion/css';
import { ReactNode, useMemo, useState, useLayoutEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Pagination } from '../Pagination/Pagination';

import { TableRow } from './types';

export interface DataGridPaginationProps {
  rows: TableRow[];
  children: (rows: TableRow[]) => ReactNode;
  rowsPerPage: number | ((rows: TableRow[]) => number);
  onPageChange?: (pageIndex: number) => void;
  initialPage?: number;
  small?: boolean;
}

export const PaginatedDataGrid = ({
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
