/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import { useEffect, useState } from 'react';
import { logger } from 'app/percona/shared/helpers/logger';
import { PAGE_SIZES } from './Pagination.constants';
export const getPageSize = (pageSize) => PAGE_SIZES.find((size) => size.value === pageSize) ? pageSize : PAGE_SIZES[0].value;
export const useStoredTablePageSize = (tableId) => {
    let pageSize = PAGE_SIZES[0].value;
    const fullId = `${tableId}-table-page-size`;
    try {
        const storedValue = parseInt(localStorage.getItem(fullId), 10);
        if (storedValue && !isNaN(storedValue)) {
            pageSize = storedValue;
        }
    }
    catch (e) {
        logger.error(e);
    }
    const [value, setValue] = useState(getPageSize(pageSize));
    useEffect(() => {
        if (tableId) {
            localStorage.setItem(fullId, `${value}`);
        }
    }, [value, fullId, tableId]);
    return [value, setValue];
};
//# sourceMappingURL=Pagination.hooks.js.map