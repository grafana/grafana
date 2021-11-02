import { __assign, __read } from "tslib";
import React, { memo } from 'react';
import DashboardSearch from './DashboardSearch';
import { useUrlParams } from 'app/core/navigation/hooks';
import { defaultQueryParams } from '../reducers/searchQueryReducer';
export var SearchWrapper = memo(function () {
    var _a = __read(useUrlParams(), 2), params = _a[0], updateUrlParams = _a[1];
    var isOpen = params.get('search') === 'open';
    var closeSearch = function () {
        if (isOpen) {
            updateUrlParams(__assign({ search: null, folder: null }, defaultQueryParams));
        }
    };
    return isOpen ? React.createElement(DashboardSearch, { onCloseSearch: closeSearch }) : null;
});
SearchWrapper.displayName = 'SearchWrapper';
//# sourceMappingURL=SearchWrapper.js.map