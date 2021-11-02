import { __assign, __makeTemplateObject } from "tslib";
import { InlineField, TextArea } from '@grafana/ui';
import { css } from '@emotion/css';
import React from 'react';
var mathPlaceholder = 'Math operations on one more queries, you reference the query by ${refId} ie. $A, $B, $C etc\n' +
    'Example: $A + $B\n' +
    'Available functions: abs(), log(), nan(), inf(), null()';
export var Math = function (_a) {
    var labelWidth = _a.labelWidth, onChange = _a.onChange, query = _a.query;
    var onExpressionChange = function (event) {
        onChange(__assign(__assign({}, query), { expression: event.target.value }));
    };
    return (React.createElement(InlineField, { label: "Expression", labelWidth: labelWidth, className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        align-items: baseline;\n      "], ["\n        align-items: baseline;\n      "]))) },
        React.createElement(TextArea, { value: query.expression, onChange: onExpressionChange, rows: 4, placeholder: mathPlaceholder })));
};
var templateObject_1;
//# sourceMappingURL=Math.js.map