/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */

import React, { FC, useState, useMemo } from 'react';

import { useStyles, IconName, Button, Select } from '@grafana/ui';

import { Messages } from './Pagination.messages';
import { getStyles } from './Pagination.styles';
import { PaginationProps } from './Pagination.types';
import { getShownPages, getLeftItemNumber, getRightItemNumber } from './Pagination.utils';

export const Pagination: FC<React.PropsWithChildren<PaginationProps>> = ({
  pageCount = 1,
  initialPageIndex = 0,
  pageSize,
  pagesPerView = 3,
  nrRowsOnCurrentPage,
  totalItems = 0,
  pageSizeOptions,
  onPageChange = () => 0,
  onPageSizeChange = () => 0,
}) => {
  const [activePageIndex, setActivePageIndex] = useState(initialPageIndex);
  const pageArray = useMemo(() => [...Array(pageCount).keys()], [pageCount]);
  // We want to center our selected page, thus we need to know how many should be on the left
  const shownPages = getShownPages(pageArray, activePageIndex, pagesPerView);
  const leftItemNumber = getLeftItemNumber(pageCount, activePageIndex, pageSize);
  const rightItemNumber = getRightItemNumber(activePageIndex, pageSize, nrRowsOnCurrentPage);
  const style = useStyles(getStyles);

  const gotoPage = (pageIndex: number) => {
    pageIndex = Math.max(0, Math.min(pageIndex, pageCount - 1));

    if (pageIndex !== activePageIndex) {
      setActivePageIndex(pageIndex);
      onPageChange(pageIndex);
    }
  };

  const pageSizeChanged = (pageSize: number) => {
    onPageSizeChange(pageSize);
    setActivePageIndex(0);
  };

  return (
    <div className={style.pagination} data-testid="pagination">
      <span className={style.pageSizeContainer}>
        <span>{Messages.rowsPerPage}</span>
        <span>
          <Select
            data-testid="pagination-size-select"
            isSearchable={false}
            value={pageSize}
            options={pageSizeOptions}
            onChange={(e) => pageSizeChanged(e.value || 0)}
          />
        </span>
      </span>
      <span className={style.pageButtonsContainer}>
        <span data-testid="pagination-items-inverval">
          {Messages.getItemsIntervalMessage(leftItemNumber, rightItemNumber, totalItems)}
        </span>
        <span>
          <Button
            data-testid="first-page-button"
            icon={'angle-double-left' as IconName}
            variant="secondary"
            disabled={activePageIndex === 0}
            onClick={() => gotoPage(0)}
          />
          <Button
            data-testid="previous-page-button"
            icon="angle-left"
            variant="secondary"
            disabled={activePageIndex === 0}
            onClick={() => gotoPage(activePageIndex - 1)}
          />
          {shownPages.map((page) => (
            <Button
              data-testid={`page-button${activePageIndex === page ? '-active' : ''}`}
              variant={activePageIndex === page ? 'primary' : 'secondary'}
              onClick={() => gotoPage(page)}
              key={page}
            >
              {page + 1}
            </Button>
          ))}
          <Button
            data-testid="next-page-button"
            icon="angle-right"
            variant="secondary"
            disabled={activePageIndex === pageCount - 1}
            onClick={() => gotoPage(activePageIndex + 1)}
            className="next-page"
          />
          <Button
            data-testid="last-page-button"
            icon={'angle-double-right' as IconName}
            variant="secondary"
            disabled={activePageIndex === pageCount - 1}
            onClick={() => gotoPage(pageCount - 1)}
          />
        </span>
      </span>
    </div>
  );
};
