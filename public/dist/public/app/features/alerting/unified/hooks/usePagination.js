import { chunk, clamp } from 'lodash';
import { useCallback, useEffect, useState, useMemo } from 'react';
export function usePagination(items, initialPage = 1, itemsPerPage) {
    var _a;
    const [page, setPage] = useState(initialPage);
    const pages = useMemo(() => chunk(items, itemsPerPage), [items, itemsPerPage]);
    const numberOfPages = pages.length;
    const pageItems = (_a = pages[page - 1]) !== null && _a !== void 0 ? _a : [];
    const pageStart = (page - 1) * itemsPerPage + 1;
    const pageEnd = clamp(page * itemsPerPage, items.length);
    const onPageChange = useCallback((newPage) => {
        setPage(clamp(newPage, 1, pages.length));
    }, [setPage, pages]);
    const nextPage = useCallback(() => onPageChange(page + 1), [page, onPageChange]);
    const previousPage = useCallback(() => onPageChange(page - 1), [page, onPageChange]);
    // Reset the current page when number of pages has been changed
    useEffect(() => setPage(1), [numberOfPages]);
    return { page, onPageChange, numberOfPages, pageItems, pageStart, pageEnd, nextPage, previousPage };
}
//# sourceMappingURL=usePagination.js.map