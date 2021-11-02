import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { css } from '@emotion/css';
import { Label, Icon, Input, Tooltip, RadioButtonGroup, useStyles2, Button, Field } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';
import { parseMatchers } from '../../utils/alertmanager';
import { debounce } from 'lodash';
var stateOptions = Object.entries(SilenceState).map(function (_a) {
    var _b = __read(_a, 2), key = _b[0], value = _b[1];
    return ({
        label: key,
        value: value,
    });
});
export var SilencesFilter = function () {
    var _a = __read(useState("queryString-" + Math.random() * 100), 2), queryStringKey = _a[0], setQueryStringKey = _a[1];
    var _b = __read(useQueryParams(), 2), queryParams = _b[0], setQueryParams = _b[1];
    var _c = getSilenceFiltersFromUrlParams(queryParams), queryString = _c.queryString, silenceState = _c.silenceState;
    var styles = useStyles2(getStyles);
    var handleQueryStringChange = debounce(function (e) {
        var target = e.target;
        setQueryParams({ queryString: target.value || null });
    }, 400);
    var handleSilenceStateChange = function (state) {
        setQueryParams({ silenceState: state });
    };
    var clearFilters = function () {
        setQueryParams({
            queryString: null,
            silenceState: null,
        });
        setTimeout(function () { return setQueryStringKey(''); });
    };
    var inputInvalid = queryString && queryString.length > 3 ? parseMatchers(queryString).length === 0 : false;
    return (React.createElement("div", { className: styles.flexRow },
        React.createElement(Field, { className: styles.rowChild, label: React.createElement("span", { className: styles.fieldLabel },
                React.createElement(Tooltip, { content: React.createElement("div", null,
                        "Filter silences by matchers using a comma separated list of matchers, ie:",
                        React.createElement("pre", null, "severity=critical, instance=~cluster-us-.+")) },
                    React.createElement(Icon, { name: "info-circle" })),
                ' ',
                "Search by matchers"), invalid: inputInvalid, error: inputInvalid ? 'Query must use valid matcher syntax' : null },
            React.createElement(Input, { key: queryStringKey, className: styles.searchInput, prefix: React.createElement(Icon, { name: "search" }), onChange: handleQueryStringChange, defaultValue: queryString !== null && queryString !== void 0 ? queryString : '', placeholder: "Search", "data-testid": "search-query-input" })),
        React.createElement("div", { className: styles.rowChild },
            React.createElement(Label, null, "State"),
            React.createElement(RadioButtonGroup, { options: stateOptions, value: silenceState, onChange: handleSilenceStateChange })),
        (queryString || silenceState) && (React.createElement("div", { className: styles.rowChild },
            React.createElement(Button, { variant: "secondary", icon: "times", onClick: clearFilters }, "Clear filters")))));
};
var getStyles = function (theme) { return ({
    searchInput: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 360px;\n  "], ["\n    width: 360px;\n  "]))),
    flexRow: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    align-items: flex-end;\n    padding-bottom: ", ";\n    border-bottom: 1px solid ", ";\n  "], ["\n    display: flex;\n    flex-direction: row;\n    align-items: flex-end;\n    padding-bottom: ", ";\n    border-bottom: 1px solid ", ";\n  "])), theme.spacing(2), theme.colors.border.strong),
    rowChild: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-right: ", ";\n    margin-bottom: 0;\n    max-height: 52px;\n  "], ["\n    margin-right: ", ";\n    margin-bottom: 0;\n    max-height: 52px;\n  "])), theme.spacing(1)),
    fieldLabel: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    font-size: 12px;\n    font-weight: 500;\n  "], ["\n    font-size: 12px;\n    font-weight: 500;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=SilencesFilter.js.map