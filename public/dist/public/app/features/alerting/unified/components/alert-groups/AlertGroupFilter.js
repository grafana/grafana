import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { AlertManagerPicker } from '../AlertManagerPicker';
import { MatcherFilter } from './MatcherFilter';
import { AlertStateFilter } from './AlertStateFilter';
import { GroupBy } from './GroupBy';
import { Button, useStyles2 } from '@grafana/ui';
import { useAlertManagerSourceName } from '../../hooks/useAlertManagerSourceName';
import { css } from '@emotion/css';
import { getFiltersFromUrlParams } from '../../utils/misc';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
export var AlertGroupFilter = function (_a) {
    var groups = _a.groups;
    var _b = __read(useState(Math.floor(Math.random() * 100)), 2), filterKey = _b[0], setFilterKey = _b[1];
    var _c = __read(useQueryParams(), 2), queryParams = _c[0], setQueryParams = _c[1];
    var _d = getFiltersFromUrlParams(queryParams), _e = _d.groupBy, groupBy = _e === void 0 ? [] : _e, queryString = _d.queryString, alertState = _d.alertState;
    var matcherFilterKey = "matcher-" + filterKey;
    var _f = __read(useAlertManagerSourceName(), 2), alertManagerSourceName = _f[0], setAlertManagerSourceName = _f[1];
    var styles = useStyles2(getStyles);
    var clearFilters = function () {
        setQueryParams({
            groupBy: null,
            queryString: null,
            alertState: null,
        });
        setTimeout(function () { return setFilterKey(filterKey + 1); }, 100);
    };
    var showClearButton = !!(groupBy.length > 0 || queryString || alertState);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(AlertManagerPicker, { current: alertManagerSourceName, onChange: setAlertManagerSourceName }),
        React.createElement("div", { className: styles.filterSection },
            React.createElement(MatcherFilter, { className: styles.filterInput, key: matcherFilterKey, queryString: queryString, onFilterChange: function (value) { return setQueryParams({ queryString: value ? value : null }); } }),
            React.createElement(GroupBy, { className: styles.filterInput, groups: groups, groupBy: groupBy, onGroupingChange: function (keys) { return setQueryParams({ groupBy: keys.length ? keys.join(',') : null }); } }),
            React.createElement(AlertStateFilter, { stateFilter: alertState, onStateFilterChange: function (value) { return setQueryParams({ alertState: value ? value : null }); } }),
            showClearButton && (React.createElement(Button, { className: styles.clearButton, variant: 'secondary', icon: "times", onClick: clearFilters }, "Clear filters")))));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    border-bottom: 1px solid ", ";\n    margin-bottom: ", ";\n  "], ["\n    border-bottom: 1px solid ", ";\n    margin-bottom: ", ";\n  "])), theme.colors.border.medium, theme.spacing(3)),
    filterSection: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    margin-bottom: ", ";\n  "], ["\n    display: flex;\n    flex-direction: row;\n    margin-bottom: ", ";\n  "])), theme.spacing(3)),
    filterInput: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    width: 340px;\n    & + & {\n      margin-left: ", ";\n    }\n  "], ["\n    width: 340px;\n    & + & {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    clearButton: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin-left: ", ";\n    margin-top: 19px;\n  "], ["\n    margin-left: ", ";\n    margin-top: 19px;\n  "])), theme.spacing(1)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=AlertGroupFilter.js.map