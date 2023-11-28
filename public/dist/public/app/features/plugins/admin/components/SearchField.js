import React, { useState, useRef } from 'react';
import { useDebounce } from 'react-use';
import { FilterInput } from '@grafana/ui';
// useDebounce has a bug which causes it to fire on first render. This wrapper prevents that.
// https://github.com/streamich/react-use/issues/759
const useDebounceWithoutFirstRender = (callBack, delay = 0, deps = []) => {
    const isFirstRender = useRef(true);
    const debounceDeps = [...deps, isFirstRender];
    return useDebounce(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        return callBack();
    }, delay, debounceDeps);
};
export const SearchField = ({ value, onSearch }) => {
    const [query, setQuery] = useState(value);
    useDebounceWithoutFirstRender(() => onSearch(query !== null && query !== void 0 ? query : ''), 500, [query]);
    return (React.createElement(FilterInput, { value: query, onKeyDown: (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                onSearch(e.currentTarget.value);
            }
        }, placeholder: "Search Grafana plugins", onChange: (value) => {
            setQuery(value);
        }, width: 46 }));
};
//# sourceMappingURL=SearchField.js.map