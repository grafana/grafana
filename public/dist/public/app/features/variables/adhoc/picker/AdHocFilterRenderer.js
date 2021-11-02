import React from 'react';
import { OperatorSegment } from './OperatorSegment';
import { AdHocFilterKey } from './AdHocFilterKey';
import { AdHocFilterValue } from './AdHocFilterValue';
export var AdHocFilterRenderer = function (_a) {
    var datasource = _a.datasource, _b = _a.filter, key = _b.key, operator = _b.operator, value = _b.value, onKeyChange = _a.onKeyChange, onOperatorChange = _a.onOperatorChange, onValueChange = _a.onValueChange, placeHolder = _a.placeHolder;
    return (React.createElement(React.Fragment, null,
        React.createElement(AdHocFilterKey, { datasource: datasource, filterKey: key, onChange: onKeyChange }),
        React.createElement("div", { className: "gf-form" },
            React.createElement(OperatorSegment, { value: operator, onChange: onOperatorChange })),
        React.createElement(AdHocFilterValue, { datasource: datasource, filterKey: key, filterValue: value, onChange: onValueChange, placeHolder: placeHolder })));
};
//# sourceMappingURL=AdHocFilterRenderer.js.map