import { __makeTemplateObject } from "tslib";
import React from 'react';
import { Label, Tooltip, Input, Icon, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
export var MatcherFilter = function (_a) {
    var className = _a.className, onFilterChange = _a.onFilterChange, queryString = _a.queryString;
    var styles = useStyles2(getStyles);
    var handleSearchChange = function (e) {
        var target = e.target;
        onFilterChange(target.value);
    };
    return (React.createElement("div", { className: className },
        React.createElement(Label, null,
            React.createElement(Tooltip, { content: React.createElement("div", null,
                    "Filter alerts using label querying, ex:",
                    React.createElement("pre", null, "{severity=\"critical\", instance=~\"cluster-us-.+\"}")) },
                React.createElement(Icon, { className: styles.icon, name: "info-circle", size: "xs" })),
            "Search by label"),
        React.createElement(Input, { placeholder: "Search", defaultValue: queryString, onChange: handleSearchChange, "data-testid": "search-query-input" })));
};
var getStyles = function (theme) { return ({
    icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-right: ", ";\n  "], ["\n    margin-right: ", ";\n  "])), theme.spacing(0.5)),
}); };
var templateObject_1;
//# sourceMappingURL=MatcherFilter.js.map