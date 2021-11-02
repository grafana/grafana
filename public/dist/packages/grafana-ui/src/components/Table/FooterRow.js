import { __assign, __rest, __values } from "tslib";
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { getTableStyles } from './styles';
import { useStyles2 } from '../../themes';
import { EmptyCell, FooterCell } from './FooterCell';
export var FooterRow = function (props) {
    var e_1, _a;
    var totalColumnsWidth = props.totalColumnsWidth, footerGroups = props.footerGroups, footerValues = props.footerValues;
    var e2eSelectorsTable = selectors.components.Panels.Visualization.Table;
    var tableStyles = useStyles2(getTableStyles);
    var EXTENDED_ROW_HEIGHT = 27;
    if (!footerValues) {
        return null;
    }
    var length = 0;
    try {
        for (var footerValues_1 = __values(footerValues), footerValues_1_1 = footerValues_1.next(); !footerValues_1_1.done; footerValues_1_1 = footerValues_1.next()) {
            var fv = footerValues_1_1.value;
            if (Array.isArray(fv) && fv.length > length) {
                length = fv.length;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (footerValues_1_1 && !footerValues_1_1.done && (_a = footerValues_1.return)) _a.call(footerValues_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var height;
    if (footerValues && length > 1) {
        height = EXTENDED_ROW_HEIGHT * length;
    }
    return (React.createElement("table", { style: {
            position: 'absolute',
            width: totalColumnsWidth ? totalColumnsWidth + "px" : '100%',
            bottom: '0px',
        } }, footerGroups.map(function (footerGroup) {
        var _a = footerGroup.getFooterGroupProps(), key = _a.key, footerGroupProps = __rest(_a, ["key"]);
        return (React.createElement("tfoot", __assign({ className: tableStyles.tfoot }, footerGroupProps, { key: key, "data-testid": e2eSelectorsTable.footer, style: height ? { height: height + "px" } : undefined }),
            React.createElement("tr", null, footerGroup.headers.map(function (column, index) {
                return renderFooterCell(column, tableStyles, height);
            }))));
    })));
};
function renderFooterCell(column, tableStyles, height) {
    var _a;
    var footerProps = column.getHeaderProps();
    if (!footerProps) {
        return null;
    }
    footerProps.style = (_a = footerProps.style) !== null && _a !== void 0 ? _a : {};
    footerProps.style.position = 'absolute';
    footerProps.style.justifyContent = column.justifyContent;
    if (height) {
        footerProps.style.height = height;
    }
    return (React.createElement("th", __assign({ className: tableStyles.headerCell }, footerProps), column.render('Footer')));
}
export function getFooterValue(index, footerValues) {
    if (footerValues === undefined) {
        return EmptyCell;
    }
    return FooterCell({ value: footerValues[index] });
}
//# sourceMappingURL=FooterRow.js.map