import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { filterSpans } from './components';
export const randomId = () => uuidv4().slice(0, 12);
export const defaultTagFilter = {
    id: randomId(),
    operator: '=',
};
export const defaultFilters = {
    spanNameOperator: '=',
    serviceNameOperator: '=',
    fromOperator: '>',
    toOperator: '<',
    tags: [defaultTagFilter],
};
/**
 * Controls the state of search input that highlights spans if they match the search string.
 * @param spans
 */
export function useSearch(spans) {
    const [search, setSearch] = useState(defaultFilters);
    const spanFilterMatches = useMemo(() => {
        return spans && filterSpans(search, spans);
    }, [search, spans]);
    return { search, setSearch, spanFilterMatches };
}
//# sourceMappingURL=useSearch.js.map