import { chunk, clamp } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';

export function usePagination<T>(items: T[], initialPage = 1, itemsPerPage: number) {
  const [page, setPage] = useState(initialPage);

  const pages = useMemo(() => chunk(items, itemsPerPage), [items, itemsPerPage]);

  const numberOfPages = pages.length;
  const pageItems = pages[page - 1] ?? [];

  const pageStart = (page - 1) * itemsPerPage + 1;
  const pageEnd = clamp(page * itemsPerPage, items.length);

  const onPageChange = useCallback(
    (newPage: number) => {
      setPage(clamp(newPage, 1, pages.length));
    },
    [setPage, pages]
  );

  const nextPage = useCallback(() => onPageChange(page + 1), [page, onPageChange]);
  const previousPage = useCallback(() => onPageChange(page - 1), [page, onPageChange]);

  // Reset the current page when number of pages has been changed
  useEffect(() => setPage(1), [numberOfPages]);

  return { page, onPageChange, numberOfPages, pageItems, pageStart, pageEnd, nextPage, previousPage };
}

export function useContinuousPagination<T>(items: T[], itemsPerPage: number) {
  const [pageIndex, setPageIndex] = useState(1);

  const hasMore = items.length > itemsPerPage * pageIndex;
  const pageItems = items.slice(0, itemsPerPage * pageIndex);

  const loadMore = useCallback(() => {
    setPageIndex((index) => index + 1);
  }, []);

  return {
    pageItems,
    pageIndex,
    loadMore,
    hasMore,
  };
}
