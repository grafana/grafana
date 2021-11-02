import { __makeTemplateObject, __read } from "tslib";
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { alertStateToReadable } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RulesTable } from './RulesTable';
export var RuleListStateSection = function (_a) {
    var rules = _a.rules, state = _a.state, _b = _a.defaultCollapsed, defaultCollapsed = _b === void 0 ? false : _b;
    var _c = __read(useState(defaultCollapsed), 2), collapsed = _c[0], setCollapsed = _c[1];
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h4", { className: styles.header },
            React.createElement(CollapseToggle, { className: styles.collapseToggle, size: "xxl", isCollapsed: collapsed, onToggle: function () { return setCollapsed(!collapsed); } }),
            alertStateToReadable(state),
            " (",
            rules.length,
            ")"),
        !collapsed && React.createElement(RulesTable, { className: styles.rulesTable, rules: rules, showGroupColumn: true })));
};
var getStyles = function (theme) { return ({
    collapseToggle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    vertical-align: middle;\n  "], ["\n    vertical-align: middle;\n  "]))),
    header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(2)),
    rulesTable: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(3)),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=RuleListStateSection.js.map