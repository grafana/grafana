import { __assign, __rest } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { getTableStyles } from './styles';
import { useStyles2 } from '../../themes';
import { Filter } from './Filter';
import { Icon } from '../Icon/Icon';
import { getFieldTypeIcon } from '../../types';
export var HeaderRow = function (props) {
    var headerGroups = props.headerGroups, data = props.data, showTypeIcons = props.showTypeIcons;
    var e2eSelectorsTable = selectors.components.Panels.Visualization.Table;
    var tableStyles = useStyles2(getTableStyles);
    return (React.createElement("div", { role: "rowgroup" }, headerGroups.map(function (headerGroup) {
        var _a = headerGroup.getHeaderGroupProps(), key = _a.key, headerGroupProps = __rest(_a, ["key"]);
        return (React.createElement("div", __assign({ className: tableStyles.thead }, headerGroupProps, { key: key, "aria-label": e2eSelectorsTable.header, role: "row" }), headerGroup.headers.map(function (column, index) {
            return renderHeaderCell(column, tableStyles, data.fields[index], showTypeIcons);
        })));
    })));
};
function renderHeaderCell(column, tableStyles, field, showTypeIcons) {
    var headerProps = column.getHeaderProps();
    if (column.canResize) {
        headerProps.style.userSelect = column.isResizing ? 'none' : 'auto'; // disables selecting text while resizing
    }
    headerProps.style.position = 'absolute';
    headerProps.style.justifyContent = column.justifyContent;
    return (React.createElement("div", __assign({ className: tableStyles.headerCell }, headerProps, { role: "columnheader" }),
        column.canSort && (React.createElement(React.Fragment, null,
            React.createElement("div", __assign({}, column.getSortByToggleProps(), { className: tableStyles.headerCellLabel, title: column.render('Header') }),
                showTypeIcons && (React.createElement(Icon, { name: getFieldTypeIcon(field), title: field === null || field === void 0 ? void 0 : field.type, size: "sm", className: tableStyles.typeIcon })),
                React.createElement("div", null, column.render('Header')),
                React.createElement("div", null, column.isSorted && (column.isSortedDesc ? React.createElement(Icon, { name: "arrow-down" }) : React.createElement(Icon, { name: "arrow-up" })))),
            column.canFilter && React.createElement(Filter, { column: column, tableStyles: tableStyles, field: field }))),
        !column.canSort && column.render('Header'),
        !column.canSort && column.canFilter && React.createElement(Filter, { column: column, tableStyles: tableStyles, field: field }),
        column.canResize && React.createElement("div", __assign({}, column.getResizerProps(), { className: tableStyles.resizeHandle }))));
}
//# sourceMappingURL=HeaderRow.js.map