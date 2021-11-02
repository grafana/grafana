import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { isCloudRulesSource } from '../../utils/datasource';
import { DetailsField } from '../DetailsField';
import { Expression } from '../Expression';
export function RuleDetailsExpression(props) {
    var _a;
    var annotations = props.annotations, rulesSource = props.rulesSource, rule = props.rule;
    var styles = getStyles();
    if (!isCloudRulesSource(rulesSource)) {
        return null;
    }
    return (React.createElement(DetailsField, { label: "Expression", horizontal: true, className: cx((_a = {}, _a[styles.exprRow] = !!annotations.length, _a)) },
        React.createElement(Expression, { expression: rule.query, rulesSource: rulesSource })));
}
var getStyles = function () { return ({
    exprRow: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: 46px;\n  "], ["\n    margin-bottom: 46px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=RuleDetailsExpression.js.map