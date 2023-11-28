import { debounce } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Icon, Input } from '@grafana/ui';
// TODO: consider moving search into grafana/ui, this is mostly the same as that in azure monitor
const Search = ({ searchFn, searchPhrase }) => {
    const [searchFilter, setSearchFilter] = useState(searchPhrase);
    const debouncedSearch = useMemo(() => debounce(searchFn, 600), [searchFn]);
    useEffect(() => {
        return () => {
            // Stop the invocation of the debounced function after unmounting
            debouncedSearch === null || debouncedSearch === void 0 ? void 0 : debouncedSearch.cancel();
        };
    }, [debouncedSearch]);
    return (React.createElement(Input, { "aria-label": "log group search", prefix: React.createElement(Icon, { name: "search" }), value: searchFilter, onChange: (event) => {
            const searchPhrase = event.currentTarget.value;
            setSearchFilter(searchPhrase);
            debouncedSearch(searchPhrase);
        }, placeholder: "search by log group name prefix" }));
};
export default Search;
//# sourceMappingURL=Search.js.map