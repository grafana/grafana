import { __read, __spreadArray } from "tslib";
import { FilterInput } from '@grafana/ui';
import React, { useState, useRef } from 'react';
import { useDebounce } from 'react-use';
// useDebounce has a bug which causes it to fire on first render. This wrapper prevents that.
// https://github.com/streamich/react-use/issues/759
var useDebounceWithoutFirstRender = function (callBack, delay, deps) {
    if (delay === void 0) { delay = 0; }
    if (deps === void 0) { deps = []; }
    var isFirstRender = useRef(true);
    var debounceDeps = __spreadArray(__spreadArray([], __read(deps), false), [isFirstRender], false);
    return useDebounce(function () {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        return callBack();
    }, delay, debounceDeps);
};
export var SearchField = function (_a) {
    var value = _a.value, onSearch = _a.onSearch;
    var _b = __read(useState(value), 2), query = _b[0], setQuery = _b[1];
    useDebounceWithoutFirstRender(function () { return onSearch(query !== null && query !== void 0 ? query : ''); }, 500, [query]);
    return (React.createElement(FilterInput, { value: query, onKeyDown: function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                onSearch(e.currentTarget.value);
            }
        }, placeholder: "Search Grafana plugins", onChange: function (value) {
            setQuery(value);
        }, width: 46 }));
};
//# sourceMappingURL=SearchField.js.map