import React from 'react';
import { AdHocFilterKey } from './AdHocFilterKey';
import { AdHocFilterValue } from './AdHocFilterValue';
import { OperatorSegment } from './OperatorSegment';
export const AdHocFilterRenderer = ({ datasource, filter: { key, operator, value }, onKeyChange, onOperatorChange, onValueChange, placeHolder, allFilters, disabled, }) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(AdHocFilterKey, { disabled: disabled, datasource: datasource, filterKey: key, onChange: onKeyChange, allFilters: allFilters }),
        React.createElement("div", { className: "gf-form" },
            React.createElement(OperatorSegment, { disabled: disabled, value: operator, onChange: onOperatorChange })),
        React.createElement(AdHocFilterValue, { disabled: disabled, datasource: datasource, filterKey: key, filterValue: value, allFilters: allFilters, onChange: onValueChange, placeHolder: placeHolder })));
};
//# sourceMappingURL=AdHocFilterRenderer.js.map