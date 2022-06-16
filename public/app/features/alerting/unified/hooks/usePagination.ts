import { useEffect, useState } from 'react';

export function usePagination<T>(items: T[], initialPage: number, itemsPerPage: number) {
  const [page, setPage] = useState(initialPage);

  const numberOfPages = Math.ceil(items.length / itemsPerPage);

  const firstItemOnPageIndex = itemsPerPage * (page - 1);
  const pageItems = items.slice(firstItemOnPageIndex, firstItemOnPageIndex + itemsPerPage);

  const onPageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Reset the current page when number of changes has been changed
  useEffect(() => setPage(1), [numberOfPages]);

  return { page, onPageChange, numberOfPages, pageItems };
}
