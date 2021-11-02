import React, { useCallback } from 'react';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from './types';
import { Icon, Tooltip } from '..';
export var FilterActions = function (_a) {
    var cell = _a.cell, field = _a.field, tableStyles = _a.tableStyles, onCellFilterAdded = _a.onCellFilterAdded;
    var onFilterFor = useCallback(function (event) {
        return onCellFilterAdded({ key: field.name, operator: FILTER_FOR_OPERATOR, value: cell.value });
    }, [cell, field, onCellFilterAdded]);
    var onFilterOut = useCallback(function (event) {
        return onCellFilterAdded({ key: field.name, operator: FILTER_OUT_OPERATOR, value: cell.value });
    }, [cell, field, onCellFilterAdded]);
    return (React.createElement("div", { className: tableStyles.filterWrapper },
        React.createElement("div", { className: tableStyles.filterItem },
            React.createElement(Tooltip, { content: "Filter for value", placement: "top" },
                React.createElement(Icon, { name: 'search-plus', onClick: onFilterFor }))),
        React.createElement("div", { className: tableStyles.filterItem },
            React.createElement(Tooltip, { content: "Filter out value", placement: "top" },
                React.createElement(Icon, { name: 'search-minus', onClick: onFilterOut })))));
};
//# sourceMappingURL=FilterActions.js.map