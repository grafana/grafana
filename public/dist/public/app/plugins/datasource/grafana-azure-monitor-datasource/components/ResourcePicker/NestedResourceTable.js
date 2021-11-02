import React from 'react';
import { cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import NestedRows from './NestedRows';
import getStyles from './styles';
var NestedResourceTable = function (_a) {
    var rows = _a.rows, selectedRows = _a.selectedRows, noHeader = _a.noHeader, requestNestedRows = _a.requestNestedRows, onRowSelectedChange = _a.onRowSelectedChange;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("table", { className: styles.table }, !noHeader && (React.createElement("thead", null,
            React.createElement("tr", { className: cx(styles.row, styles.header) },
                React.createElement("td", { className: styles.cell }, "Scope"),
                React.createElement("td", { className: styles.cell }, "Type"),
                React.createElement("td", { className: styles.cell }, "Location"))))),
        React.createElement("div", { className: styles.tableScroller },
            React.createElement("table", { className: styles.table },
                React.createElement("tbody", null,
                    React.createElement(NestedRows, { rows: rows, selectedRows: selectedRows, level: 0, requestNestedRows: requestNestedRows, onRowSelectedChange: onRowSelectedChange }))))));
};
export default NestedResourceTable;
//# sourceMappingURL=NestedResourceTable.js.map