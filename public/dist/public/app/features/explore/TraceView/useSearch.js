import { __read } from "tslib";
import { useMemo, useState } from 'react';
import { filterSpans } from '@jaegertracing/jaeger-ui-components';
/**
 * Controls the state of search input that highlights spans if they match the search string.
 * @param spans
 */
export function useSearch(spans) {
    var _a = __read(useState(''), 2), search = _a[0], setSearch = _a[1];
    var spanFindMatches = useMemo(function () {
        return search && spans ? filterSpans(search, spans) : undefined;
    }, [search, spans]);
    return { search: search, setSearch: setSearch, spanFindMatches: spanFindMatches };
}
//# sourceMappingURL=useSearch.js.map