export const getShownPages = (pageArray: number[], activePageIndex: number, pagesPerView: number) => {
  const pageCount = pageArray.length;
  const maxVisiblePages = Math.min(pagesPerView, pageCount);
  const pagesBehind = pagesPerView - (pagesPerView - Math.ceil(pagesPerView / 2)) - 1;
  let firstPageIndex = Math.max(activePageIndex - pagesBehind, 0);
  let lastPageIndex = firstPageIndex + maxVisiblePages;

  // If we can't keep the selected page in the center anymore, it should just move rightwards
  if (lastPageIndex >= pageCount + 1 && lastPageIndex - maxVisiblePages > 0) {
    lastPageIndex = pageCount;
    firstPageIndex = lastPageIndex - maxVisiblePages;
  }
  return pageArray.slice(firstPageIndex, lastPageIndex);
};

export const getLeftItemNumber = (pageCount: number, activePageIndex: number, pageSize: number) => {
  if (activePageIndex >= pageCount) {
    activePageIndex = pageCount - 1;
  }

  return pageCount > 0 ? activePageIndex * pageSize + 1 : 0;
};

export const getRightItemNumber = (activePageIndex: number, pageSize: number, nrRowsOnCurrentPage: number) =>
  activePageIndex * pageSize + nrRowsOnCurrentPage;
