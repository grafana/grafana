import { __makeTemplateObject, __read } from "tslib";
import React from 'react';
import { RadioButtonGroup, Label, useStyles2 } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';
import { css } from '@emotion/css';
export var AlertStateFilter = function (_a) {
    var onStateFilterChange = _a.onStateFilterChange, stateFilter = _a.stateFilter;
    var styles = useStyles2(getStyles);
    var alertStateOptions = Object.entries(AlertState)
        .sort(function (_a, _b) {
        var _c = __read(_a, 1), labelA = _c[0];
        var _d = __read(_b, 1), labelB = _d[0];
        return (labelA < labelB ? -1 : 1);
    })
        .map(function (_a) {
        var _b = __read(_a, 2), label = _b[0], state = _b[1];
        return ({
            label: label,
            value: state,
        });
    });
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement(Label, null, "State"),
        React.createElement(RadioButtonGroup, { options: alertStateOptions, value: stateFilter, onChange: onStateFilterChange })));
};
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-left: ", ";\n  "], ["\n    margin-left: ", ";\n  "])), theme.spacing(1)),
}); };
var templateObject_1;
//# sourceMappingURL=AlertStateFilter.js.map